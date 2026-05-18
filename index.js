const express = require('express');
const cors = require('cors');
const dontenv = require('dotenv');
const app = express();
dontenv.config()
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

//mongodb connection
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    const db = client.db("mediqueue");
    const tutorsCollection = db.collection("tutors");

    app.post('/tutors', async (req, res) => {
      const tutor = req.body;
      console.log('req-tutor:',tutor);
      const result = await tutorsCollection.insertOne(tutor);
      console.log('result:',result);
      res.send(result);
    });

    app.get('/tutors', async (req, res) => {
      const tutors = await tutorsCollection.find().toArray();
      res.send(tutors);
    });



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    
  }
}
run().catch(console.dir);


//initialize routes
app.get('/', (req, res) => {
  res.send('server is running');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
