const express = require("express");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion } = require("mongodb");

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
    app.get("/users", async (req, res) => {});
    // user role
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });
    app.patch("/users", async (req, res) => {});
    app.delete("/users", async (req, res) => {});

    // shcolarship related api
    app.post("/scholarships", async (req, res) => {});
    app.get("/scholarships", async (req, res) => {});
    app.get("/scholarships/:id", async (req, res) => {});
    app.patch("/scholarships/:id", async (req, res) => {});
    app.delete("/scholarships/:id", async (req, res) => {});

    // applications related api
    app.post("/applications", async (req, res) => {});
    app.get("/applications", async (req, res) => {});
    app.patch("/applications/:id/status", async (req, res) => {});
    app.delete("/applications/:id", async (req, res) => {});

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
