const express = require("express")
const app = express();
const port = process.env.PORT || 5000;
const cors = require('cors');
require("dotenv").config()
const jwt = require("jsonwebtoken")
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)
//middleware
app.use(cors())
app.use(express.json())

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

const verifyToken = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: "Unauthorized request." })
    }
    const token = authorization.split(" ")[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: "Unauthorized request." })
        }
        req.decoded = decoded;
        next()
    })

}


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const usersCollection = client.db("bistroDb").collection('users')
        const menuCollection = client.db("bistroDb").collection('menu')
        const reviewsCollection = client.db("bistroDb").collection('reviews')
        const cartsCollection = client.db("bistroDb").collection('carts')
        const paymentCollection = client.db("bistroDb").collection('payments')

        app.get("/menu", async (req, res) => {
            const menus = await menuCollection.find().toArray();
            res.send(menus)
        })

        //add item
        app.post("/menu", verifyToken, async (req, res) => {
            const newItem = req.body;
            const result = await menuCollection.insertOne(newItem);
            res.send(result)
        })

        //menu delte from manageitem compo.
        app.delete("/menu/:id", async (req, res) => {

            const id = req.params.id;

            const query = { _id: new ObjectId(id) }
            const result = await menuCollection.deleteOne(query);
            console.log(result);
            res.send(result)

        })



        // app.delete("/menu/:id", async (req, res) => {
        //     const id = req.params.id;
        //     console.log(id);
        //     const filter = { _id: new ObjectId(id) }
        //     const result = await menuCollection.deleteOne(filter);
        //     console.log(result);
        //     res.send(result)
        // })
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
            if (existing) {
                return res.send({ message: "Already exists." })
            }
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })
        app.delete("/users/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query);
            res.send(result)
        })


        //warning: use verifyjwt before using verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== "admin") {
                return res.status(403).send({ error: true, message: "forbidden access" })
            }
            next()
        }

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            //here i have to change decoded.user to decoded.email
            const decodedEmail = req.decoded.user;
            if (email !== decodedEmail) {
                return res.status(401).send({ admin: false })
            }
            const filter = { email }
            const user = await usersCollection.findOne(filter);
            const result = { admin: user?.role === "admin" }
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
            res.send(result)
        })


        //cart collection
        app.post("/carts", async (req, res) => {
            const item = req.body;
            const result = await cartsCollection.insertOne(item)
            res.send(result)
        })
        app.get("/carts", verifyToken, async (req, res) => {
            const email = req.query.email;


            if (!email) {
                res.send([])
            }

            const decodedEmail = req.decoded.user;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: "Forbidden access." })
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

        // make jwt
        app.post("/jwt", (req, res) => {
            const user = req.body.email;

            const token = jwt.sign({ user }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "2d" });

            res.send({ token })
        })
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            console.log(amount);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
                payment_method_types: ["card"]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })
        //payments
        app.post("/payments", verifyToken, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);
            const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } };
            const deleteResult = await cartsCollection.deleteMany(query)
            res.send({ insertResult, deleteResult })
        })


        //admin dashabord
        app.get("/admin-stats", async (req, res) => {
            const users = await usersCollection.estimatedDocumentCount();
            const products = await menuCollection.estimatedDocumentCount();
            const orders = await paymentCollection.estimatedDocumentCount()
            //best way to get some of price  filed to use group and some operator;
            // paymentCollection.aggregate(
            //     [
            //         {
            //             $group:{
            //                 _id:null,
            //                 total:{$sum:'$price'}
            //             }
            //         }
            //     ]
            // ).toArray()
            const payments = await paymentCollection.find().toArray();
            const revenue = payments.reduce((sum, item) => {
                return sum + item.price
            }, 0)

            res.send({ users, products, orders, revenue })
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