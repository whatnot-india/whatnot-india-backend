const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const Kyc = require("../models/Kyc");
const { businessTypes } = require("../models/Kyc");
const Customer = require("../models/Customer");

const router = express.Router();

// ------------------- MULTER STORAGE -------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(
      __dirname,
      "..",
      "uploads",
      "kycs",
      req.user._id.toString()
    );
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // keep original name, avoid collisions
  },
});

// ------------------- FILE FILTER (PDF ONLY) -------------------
function fileFilter(req, file, cb) {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Only PDF files are allowed"), false);
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter });

// ------------------- CUSTOMER UPLOAD -------------------
router.post(
  "/upload",
  protect,
  authorizeRoles("Customer"),
  upload.any(), // allow dynamic fields
  async (req, res) => {
    const { businessType } = req.body;

    try {
      if (!businessTypes[businessType]) {
        return res.status(400).json({ message: "Invalid business type" });
      }

      let kyc = await Kyc.findOne({ customer: req.user._id });
      if (kyc && kyc.status === "APPROVED") {
        return res
          .status(400)
          .json({ message: "KYC already approved, cannot reupload" });
      }

      // ------------------- CASE 1: PARTNERSHIP -------------------
      if (businessType === "PARTNERSHIP") {
        let partnersData = [];
        const partners = JSON.parse(req.body.partners || "[]"); 

        if (!partners.length) {
          return res.status(400).json({ message: "Partners info required" });
        }

        partners.forEach((p, index) => {
          const docs = {};
          businessTypes.PARTNERSHIP.forEach((doc) => {
            const fieldName = `${doc}_${index}`; // PAN_0, AADHAR_0 etc.
            const file = req.files.find((f) => f.fieldname === fieldName);
            if (file) {
              docs[doc] = `/uploads/kycs/${req.user._id}/${file.filename}`;
            }
          });

          const missingDocs = businessTypes.PARTNERSHIP.filter((d) => !docs[d]);
          if (missingDocs.length > 0) {
            throw new Error(
              `Missing documents for partner ${p.name}: ${missingDocs.join(", ")}`
            );
          }

          partnersData.push({
            name: p.name,
            documents: docs,
          });
        });

        if (!kyc) {
          kyc = new Kyc({
            customer: req.user._id,
            businessType,
            partners: partnersData,
            status: "PENDING",
          });
        } else {
          kyc.businessType = businessType;
          kyc.partners = partnersData;
          kyc.documents = undefined; // clear single docs
          kyc.status = "PENDING";
          kyc.rejectionReason = null;
        }
      } 
      // ------------------- CASE 2: ALL OTHER TYPES -------------------
      else {
        const requiredDocs = businessTypes[businessType];
        const uploadedDocs = {};

        requiredDocs.forEach((doc) => {
          const file = req.files.find((f) => f.fieldname === doc);
          if (file) {
            uploadedDocs[doc] = `/uploads/kycs/${req.user._id}/${file.filename}`;
          }
        });

        const missingDocs = requiredDocs.filter((doc) => !uploadedDocs[doc]);
        if (missingDocs.length > 0) {
          return res.status(400).json({
            message: "Missing required documents",
            missing: missingDocs,
          });
        }

        if (!kyc) {
          kyc = new Kyc({
            customer: req.user._id,
            businessType,
            documents: uploadedDocs,
            status: "PENDING",
          });
        } else {
          kyc.businessType = businessType;
          kyc.documents = uploadedDocs;
          kyc.partners = []; // clear partners
          kyc.status = "PENDING";
          kyc.rejectionReason = null;
        }
      }

      await kyc.save();
      res.status(201).json({ message: "KYC uploaded successfully", kyc });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ------------------- CUSTOMER: GET MY KYC -------------------
router.get(
  "/my-kyc",
  protect,
  authorizeRoles("Customer"),
  async (req, res) => {
    try {
      const kyc = await Kyc.findOne({ customer: req.user._id });
      if (!kyc) {
        return res.json({ message: "No KYC uploaded yet" });
      }
      res.json(kyc);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ------------------- ADMIN: GET ALL CUSTOMERS WITH KYC STATUS -------------------
router.get(
  "/customers/with-kyc",
  protect,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const customers = await Customer.find().sort({ createdAt: -1 });
      const kycs = await Kyc.find().populate("customer");

      const response = customers.map((cust) => {
        const kyc = kycs.find(
          (k) => k.customer._id.toString() === cust._id.toString()
        );

        return {
          id: cust._id,
          name: cust.name,
          email: cust.email,
          mobile: cust.mobile,
          city: cust.city,
          state: cust.state,
          pincode: cust.pincode,
          createdAt: cust.createdAt,
          role: cust.role,
          // KYC info
          businessType: kyc ? kyc.businessType : null,
          status: kyc ? kyc.status : "NOT_UPLOADED",
          rejectionReason: kyc ? kyc.rejectionReason : null,
          documents: kyc ? kyc.documents : null,
          partners: kyc ? kyc.partners : null,
        };
      });

      res.json(response);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ------------------- ADMIN VIEW ALL KYCs -------------------
router.get("/all", protect, authorizeRoles("Admin"), async (req, res) => {
  try {
    const kycs = await Kyc.find()
      .populate("customer", "name email mobile city state pincode")
      .sort({ createdAt: -1 });
    res.json(kycs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------- ADMIN VIEW SPECIFIC CUSTOMER KYC -------------------
router.get("/:customerId", protect, authorizeRoles("Admin"), async (req, res) => {
  try {
    const kyc = await Kyc.findOne({
      customer: req.params.customerId,
    }).populate("customer", "name email mobile city state pincode");
    if (!kyc) return res.status(404).json({ message: "KYC not found" });
    res.json(kyc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------- ADMIN APPROVE -------------------
router.put("/:id/approve", protect, authorizeRoles("Admin"), async (req, res) => {
  try {
    const kyc = await Kyc.findById(req.params.id).populate("customer");
    if (!kyc) return res.status(404).json({ message: "KYC not found" });

    kyc.status = "APPROVED";
    kyc.rejectionReason = null;
    await kyc.save();

    res.json({ message: "KYC approved", kyc });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------- ADMIN REJECT -------------------
router.put("/:id/reject", protect, authorizeRoles("Admin"), async (req, res) => {
  const { reason } = req.body;

  try {
    const kyc = await Kyc.findById(req.params.id).populate("customer");
    if (!kyc) return res.status(404).json({ message: "KYC not found" });

    kyc.status = "REJECTED";
    kyc.rejectionReason = reason || "Not specified";
    await kyc.save();

    res.json({ message: "KYC rejected", kyc });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
