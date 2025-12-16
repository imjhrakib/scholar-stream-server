const express = require("express");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const admin = require("firebase-admin");

// index.js
const decoded = Buffer.from(
  process.env.FIREBASE_SERVICE_KEY,
  "base64"
).toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// verify Firebase Token middleware
const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

// middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@jhratlas.m93791y.mongodb.net/?appName=jhrAtlas`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("scholarStreamDB");
    const userCollection = db.collection("users");
    const scholarshipCollection = db.collection("scholarships");
    const applicationCollection = db.collection("applications");
    const reviewCollection = db.collection("reviews");

    //middleware for admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userCollection.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    //middleware for admin
    const verifyModerator = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userCollection.findOne(query);
      if (!user || user.role !== "moderator") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // users related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "student";
      user.createdAt = new Date();
      const email = user.email;
      const userExist = await userCollection.findOne({ email });
      if (userExist) {
        return res.send({ message: "user exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.get("/users", verifyFBToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email/myProfile", verifyFBToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // manage users
    app.get(
      "/users/role/:role",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const role = req.params.role;
        const users = await userCollection.find({ role }).toArray();
        res.send(users);
      }
    );

    // user for useRole hooks
    app.get("/users/:email/role", verifyFBToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.patch(
      "/users/:id/role",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { role } = req.body;
        const query = { _id: new ObjectId(id) };
        const updateRole = {
          $set: {
            role,
          },
        };
        const result = await userCollection.updateOne(query, updateRole);
        res.send(result);
      }
    );
    app.delete("/users/:id", verifyFBToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // shcolarship related api
    app.post("/scholarships", verifyFBToken, verifyAdmin, async (req, res) => {
      const scholarship = req.body;
      scholarship.createdAt = new Date();
      const result = await scholarshipCollection.insertOne(scholarship);
      res.send(result);
    });

    app.get("/scholarships/search", verifyFBToken, async (req, res) => {
      try {
        const {
          search = "",
          country = "",
          sort = "",
          page = 1,
          limit = 6,
        } = req.query;

        const query = {};

        if (search) {
          query.$or = [
            { scholarshipName: { $regex: search, $options: "i" } },
            { universityName: { $regex: search, $options: "i" } },
            { degree: { $regex: search, $options: "i" } },
          ];
        }

        if (country) {
          query.country = country;
        }

        let sortQuery = {};
        if (sort === "feeLow") {
          sortQuery.applicationFees = 1;
        } else if (sort === "feeHigh") {
          sortQuery.applicationFees = -1;
        } else {
          sortQuery.createdAt = -1;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const result = await scholarshipCollection
          .find(query)
          .sort(sortQuery)
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        const total = await scholarshipCollection.countDocuments(query);

        res.send({
          result,
          total,
        });
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch scholarships" });
      }
    });

    app.get("/scholarships", verifyFBToken, async (req, res) => {
      const result = await scholarshipCollection
        .find()
        .sort({ applicationFees: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    app.get("/scholarship/:id", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await scholarshipCollection.findOne(query);
      res.send(result);
    });
    app.patch(
      "/scholarships/:id",
      verifyFBToken,

      async (req, res) => {
        const id = req.params.id;
        const updateInfo = req.body;

        const query = { _id: new ObjectId(id) };
        const result = await scholarshipCollection.updateOne(query, {
          $set: updateInfo,
        });
        res.send(result);
      }
    );
    app.delete(
      "/scholarships/:id",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await scholarshipCollection.deleteOne(query);
        res.send(result);
      }
    );

    // applications related api
    app.post("/application", verifyFBToken, async (req, res) => {
      const application = req.body;
      application.status = "pending";
      application.paymentStatus = "unpaid";
      application.createdAt = new Date();
      const result = await applicationCollection.insertOne(application);
      res.send(result);
    });
    app.get("/applications/:email", verifyFBToken, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await applicationCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/applications", verifyFBToken, async (req, res) => {
      const result = await applicationCollection.find().toArray();
      res.send(result);
    });
    app.get("/application/:id/details", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await applicationCollection.findOne(query);

      res.send(result);
    });

    // for moderator
    app.patch(
      "/application/:id/status",
      verifyFBToken,
      verifyModerator,
      async (req, res) => {
        const id = req.params.id;
        const { status } = req.body;
        const query = { _id: new ObjectId(id) };
        const result = await applicationCollection.updateOne(query, {
          $set: { status },
        });
        res.send(result);
      }
    );
    app.patch(
      "/application/:id/feedback",
      verifyFBToken,
      verifyModerator,
      async (req, res) => {
        const id = req.params.id;
        const { feedback } = req.body;

        const query = { _id: new ObjectId(id) };

        const updatedDoc = {
          $set: { feedback },
        };
        const result = await applicationCollection.updateOne(query, updatedDoc);

        res.send(result);
      }
    );

    app.delete(
      "/application/:id/moderator",
      verifyFBToken,
      verifyModerator,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await applicationCollection.deleteOne(query);
        res.send(result);
      }
    );
    app.delete("/application/:id/student", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await applicationCollection.deleteOne(query);
      res.send(result);
    });

    // payment related api
    app.post("/payment-checkout-session", async (req, res) => {
      const applicationInfo = req.body;

      const amount = parseInt(applicationInfo.cost) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: `Application Fee: ${applicationInfo.applicationName}`,
                description: `University: ${applicationInfo.universityName}\nDeadline: ${applicationInfo.deadline}\nFee: $${applicationInfo.cost}`,
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          applicationId: applicationInfo.applicationId,
        },
        customer_email: applicationInfo.userEmail,
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled?session_id={CHECKOUT_SESSION_ID}`,
      });

      res.send({ url: session.url });
    });

    //update
    app.patch("/payment-success", verifyFBToken, async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // handle duplicate
      const transactionId = session.payment_intent;
      const query = { transactionId: transactionId };
      const paymentExist = await applicationCollection.findOne(query);

      const id = session.metadata.applicationId;

      if (paymentExist) {
        return res.send({
          message: "already exits",
          transactionId: transactionId,
          applicationId: id,
          scholarshipName: paymentExist.scholarshipName,
          universityName: paymentExist.universityName,
          applicationFees: paymentExist.applicationFees,
        });
      }
      if (session.payment_status === "paid") {
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            paymentStatus: "paid",
            transactionId: transactionId,
          },
        };
        await applicationCollection.updateOne(query, update);

        const application = await applicationCollection.findOne(query);
        return res.send({
          success: true,
          transactionId,
          applicationId: id,
          scholarshipName: application.scholarshipName,
          universityName: application.universityName,
          applicationFees: application.applicationFees,
        });
      }
    });
    app.get("/payment-cancelled", async (req, res) => {
      const sessionId = req.query.session_id;
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const applicationId = session?.metadata?.applicationId;
        console.log(applicationId);
        const application = await applicationCollection.findOne({
          _id: new ObjectId(applicationId),
        });
        res.send({
          scholarshipName: application?.scholarshipName || "",
          universityName: application?.universityName || "",
          deadline: application?.deadline || "",
          applicationFees: application?.applicationFees || "",
          errorMessage: "Payment was cancelled by user.",
        });
      } catch (err) {
        res.send({
          scholarshipName: "",
          errorMessage: "Unable to fetch payment info.",
        });
      }
    });

    // reviews related api
    app.post("/reviews/:id", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      const review = req.body;

      review.createdAt = new Date();
      const reviewExist = await reviewCollection.findOne({ applicationId: id });
      if (reviewExist) {
        return res.send({ message: "review already exist" });
      }

      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    app.patch("/review/:id/edit", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      const { rating, comment } = req.body;
      const updatedReview = {
        $set: {
          rating,
          comment,
        },
      };
      const query = { _id: new ObjectId(id) };
      const result = await reviewCollection.updateOne(query, updatedReview);
      res.send(result);
    });
    app.get("/reviews", verifyFBToken, verifyModerator, async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });
    app.get("/reviews/:email", verifyFBToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        userEmail: email,
      };
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/reviews/:id/review", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      const query = { scholarshipId: id };
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/reviews/:id", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
