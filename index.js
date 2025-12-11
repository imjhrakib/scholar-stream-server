const express = require("express");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const admin = require("firebase-admin");

const serviceAccount = require("./scholarship-stream-firebase-adminsdk.json");

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
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email/myProfile", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.get("/users/role/:role", async (req, res) => {
      const role = req.params.role;

      const users = await userCollection.find({ role }).toArray();
      res.send(users);
    });
    // user role
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.patch("/users/:id/role", async (req, res) => {
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
    });
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // shcolarship related api
    app.post("/scholarships", async (req, res) => {
      const scholarship = req.body;
      scholarship.createdAt = new Date();
      const result = await scholarshipCollection.insertOne(scholarship);
      res.send(result);
    });
    app.get("/scholarships", async (req, res) => {
      const result = await scholarshipCollection
        .find()
        .sort({ postDate: 1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    app.get("/scholarship/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await scholarshipCollection.findOne(query);
      res.send(result);
    });
    app.patch("/scholarships/:id", async (req, res) => {
      const id = req.params.id;
      const updateInfo = req.body;

      const query = { _id: new ObjectId(id) };
      const result = await scholarshipCollection.updateOne(query, {
        $set: updateInfo,
      });
      res.send(result);
    });
    app.delete("/scholarships/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await scholarshipCollection.deleteOne(query);
      res.send(result);
    });

    // applications related api
    app.post("/applications", async (req, res) => {
      const application = req.body;
      application.status = "pending";
      application.paymentStatus = "unpaid";
      application.createdAt = new Date();
      const result = await applicationCollection.insertOne(application);
      res.send(result);
    });
    app.get("/applications/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await applicationCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/applications", async (req, res) => {
      const result = await applicationCollection.find().toArray();
      res.send(result);
    });
    app.get("/application/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await applicationCollection.findOne(query);

      res.send(result);
    });
    app.patch("/application/:id/status", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const query = { _id: id };
      const result = await applicationCollection.updateOne(query, {
        $set: { status },
      });
      res.send(result);
    });
    app.patch("/application/:id/feedback", async (req, res) => {
      const id = req.params.id;
      const { feedback } = req.body;

      const query = { _id: id };

      const updatedDoc = {
        $set: { feedback },
      };
      const result = await applicationCollection.updateOne(query, updatedDoc);

      res.send(result);
    });

    app.delete("/applications/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
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
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: `Please pay for: ${applicationInfo.applicationName}`,
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
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      res.send({ url: session.url });
    });

    //update
    app.patch("/payment-success", async (req, res) => {
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
          amount: paymentExist.cost,
        });
      }
      if (session.payment_status === "paid") {
        const query = { _id: id };
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
          amount: application.applicationFees,
        });
      }
    });

    // reviews related api
    app.post("/reviews", async (req, res) => {});
    app.get("/reviews", async (req, res) => {});
    app.delete("/reviews", async (req, res) => {});

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
