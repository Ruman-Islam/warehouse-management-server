const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Middleware
app.use(cors());
app.use(express.json());

const verifyUser = (req, res, next) => {
    const accessKeyHolder = req.headers?.authorization;
    if (!accessKeyHolder) {
        return res.status(401).send({ message: "Unauthorized access" })
    } else {
        const accessToken = accessKeyHolder.split(' ')[1];
        jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).send({ message: "Forbidden access" })
            } else {
                req.decoded = decoded;
                next();
            }
        })
    }
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vzdnu.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const run = async () => {
    try {
        await client.connect();
        const productsCollection = client.db("warehouse").collection("products");
        const sellersInfoCollection = client.db("warehouse").collection("sellers-info");
        const topSellingProductsCollection = client.db("warehouse").collection("top-selling-products");

        // generate token
        // http://localhost:5000/login
        app.post('/login', async (req, res) => {
            const userEmail = req.body;
            const accessToken = jwt.sign(userEmail, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1d'
            });
            res.send(accessToken);
        })

        // http://localhost:5000/products
        app.get('/products', async (req, res) => {
            const limit = parseInt(req.query.limit);
            const pageNumber = parseInt(req.query.pageNumber);
            const count = await productsCollection.estimatedDocumentCount();
            const cursor = productsCollection.find({});
            const products = await cursor.skip(pageNumber * limit).limit(limit).toArray();

            try {
                if (products.length === 0) {
                    res.status(404).send({ success: false, message: 'No data found' });
                } else {
                    res.send({ success: true, products, count });
                }
            } catch (err) {
                res.status(500).send({ success: false, message: 'Internal server error' });
            }
        })

        // http://localhost:5000/products-user
        app.get('/products-user', verifyUser, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.query.email;
            const limit = parseInt(req.query.limit);
            const pageNumber = parseInt(req.query.pageNumber);
            const cursor = productsCollection.find({ email });
            const allUserProducts = productsCollection.find({ email });
            const count = await allUserProducts.toArray();
            const products = await cursor.skip(pageNumber * limit).limit(limit).toArray();
            try {
                if (decodedEmail === email) {
                    if (products.length === 0) {
                        res.status(404).send({ success: false, message: 'No data found' });
                    } else {
                        res.send({ success: true, products, count: count.length });
                    }
                } else {
                    res.status(403).send({ success: false, message: 'Forbidden access' });
                }
            } catch (err) {
                res.status(500).send({ success: false, message: 'Internal server error' });
            }
        });

        // http://localhost:5000/product
        app.get('/product/:productId', async (req, res) => {
            const productId = req.params.productId;
            const query = { _id: ObjectId(productId) };
            const product = await productsCollection.findOne(query);
            try {
                if (!product) {
                    res.send({ success: false, message: "Product not available right now" })
                } else {
                    res.send({ success: true, product })
                }
            } catch (err) {
                res.status(500).send({ success: false, message: 'Internal server error' });
            }
        });

        // http://localhost:5000/product
        app.put('/product/:productId', async (req, res) => {
            const productId = req.params.productId;
            const updateQuantity = req.body;
            const query = { _id: ObjectId(productId) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    quantity: updateQuantity.newQuantity
                }
            }
            try {
                const result = await productsCollection.updateOne(query, updatedDoc, options);
                if (!result) {
                    res.status(500).send({ success: false, message: "Sorry! couldn't update this time" });
                } else {
                    res.send({ success: true, result })
                }
            } catch (error) {
                res.status(500).send({ success: false, message: "Sorry! couldn't update this time" });
            }
        })

        // http://localhost:5000/add-product
        app.post('/add-product', async (req, res) => {
            const product = req.body;
            try {
                const result = await productsCollection.insertOne(product);
                if (!result) {
                    res.send({ success: false, message: "Sorry! couldn't add this time" })
                } else {
                    res.send({ success: true, result })
                }
            } catch (error) {
                res.status(500).send({ success: false, message: "Sorry! couldn't add this time" });
            }

        })

        // http://localhost:5000/top-sellers
        app.get('/top-sellers', async (req, res) => {
            const query = req.query;
            const cursor = sellersInfoCollection.find(query);
            const sellersInfo = await cursor.toArray();
            res.send(sellersInfo);
        })

        // http://localhost:5000/top-selling-products
        app.get('/top-selling-products', async (req, res) => {
            const query = req.query;
            const cursor = topSellingProductsCollection.find(query);
            const topSellingProducts = await cursor.toArray();
            res.send(topSellingProducts);
        })

        app.delete('/delete-product/:productId', async (req, res) => {
            const productId = req.params.productId;
            const query = { _id: ObjectId(productId) };
            const product = await productsCollection.deleteOne(query);
            try {
                if (!product) {
                    res.send({ success: false, message: "Sorry! couldn't delete this time" })
                } else {
                    res.send({ success: true, product })
                }
            } catch (error) {
                res.status(500).send({ success: false, message: "Sorry! couldn't delete this time" });
            }
        })

    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

// http://localhost:5000/
app.get('/', (req, res) => {
    res.send('Server is running well')
})

app.listen(port, () => {
    console.log('Warehouse server is running on port -', port);
})

// https://protected-waters-02155.herokuapp.com/