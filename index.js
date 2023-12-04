const express = require("express")
const app = express();
const port = process.env.PORT || 5000;
const cors = require('cors');
app.use(cors())
app.use(express.json())
require("dotenv").config()

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1u9t2.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const usersCollection = client.db("bistroDb").collection('users')
        const menuCollection = client.db("bistroDb").collection('menu')
        const reviewsCollection = client.db("bistroDb").collection('reviews')
        const cartsCollection = client.db("bistroDb").collection('carts')

        app.get("/menu", async (req, res) => {
            const menus = await menuCollection.find().toArray();
            res.send(menus)
        })
        app.get("/reviews", async (req, res) => {
            const reviews = await reviewsCollection.find().toArray();
            res.send(reviews)
        })

        //users collection api

        app.get("/users", async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })

        app.post("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user?.email }
            const existing = await usersCollection.findOne(query);
            console.log(existing);
            if (existing) {
                return res.send({ message: "Already exists." })
            }
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })


        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: "admin"
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc)
        })


        //cart collection
        app.post("/carts", async (req, res) => {
            const item = req.body;
            const result = await cartsCollection.insertOne(item)
            res.send(result)
        })
        app.get("/carts", async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([])
            }
            const query = { email: email };
            const result = await cartsCollection.find(query).toArray();

            res.send(result)
        })
        app.delete("/carts/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartsCollection.deleteOne(query)
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("welcome to bistro boss")
})

app.listen(port, () => {
    console.log("Bistro boss is running");
})