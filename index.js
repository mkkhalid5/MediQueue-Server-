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
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const jwks = createRemoteJWKSet(new URL(`${process.env.JWT_SECRET}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
  const authHeader = await req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized access' })
  }
  const token = await authHeader?.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized access' })
  }

  try {
    const { payload } = await jwtVerify(token, jwks);
    console.log(payload, 'dd');
    next();
  }
  catch (error) {
    console.log('error:', error);
    return res.status(403).send({ message: 'Forbidden access' })
  }
}

async function run() {
  try {
    //await client.connect();
    const db = client.db("mediqueue");
    const tutorsCollection = db.collection("tutors");
    const bookingsCollection = db.collection("bookings");

    //create tutor
    app.post('/tutors', async (req, res) => {
      const tutor = req.body;
      console.log('req-tutor:', tutor);
      const result = await tutorsCollection.insertOne(tutor);
      console.log('result:', result);
      res.send(result);
    });


    //get tutors
    app.get('/tutorsAvailable', async (req, res) => {
      const tutors = await tutorsCollection.aggregate([
        {
          $limit: 6
        }
      ]).toArray();
      res.send(tutors);
    });

    //get all tutors
    app.get('/tutors', async (req, res) => {
      const search = req.query.search || "";
      const startDate = req.query.startDate || "";
      const endDate = req.query.endDate || "";
      let query = {};
      if (search) {
        query.$or = [
          {
            tutorName: {
              $regex: search,
              $options: "i",
            },
          },
          {
            subject: {
              $regex: search,
              $options: "i",
            },
          },
        ];
      }

      if (startDate || endDate) {
        query.sessionDate = {};
        if (startDate) {
          query.sessionDate.$gte = startDate;
        }
        if (endDate) {
          query.sessionDate.$lte = endDate;
        }
      }
      console.log('query:', query);
      const tutors = await tutorsCollection
        .find(query)
        .toArray();
      res.send(tutors);
    });

    //get tutor by id
    app.get('/tutors/:id', verifyToken, async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          message: "Invalid ID"
        });
      }
      const result = await tutorsCollection.findOne({
        _id: new ObjectId(id)
      });
      res.json(result)
    })

    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      console.log('req-booking:', booking);

      const existingBooking = await bookingsCollection.findOne({
        tutorId: booking.tutorId,
        studentEmail: booking.studentEmail
      });

      

      const tutor = await tutorsCollection.findOne({
        _id: new ObjectId(booking.tutorId)
      });
      if (tutor.slot <= 0) {
        return res.status(400).send({
          success: false,
          message: "No slots available"
        });
      }
      const result = await bookingsCollection.insertOne(booking);
      const tutorId = booking.tutorId;
      const updateResult = await tutorsCollection.updateOne(
        { _id: new ObjectId(tutorId) },
        {
          $inc: {
            slot: -1
          }
        }
      );

      console.log('result:', result);
      res.send({
        success: true,
        result,
        updateResult
      });
    });

    app.delete('/bookings/:id', verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.get('/bookings/:studentId', verifyToken, async (req, res) => {
      const { studentId } = req.params;
      const bookings = await bookingsCollection
        .find({ studentId })
        .toArray();

      const currentDate = new Date();
      for (const booking of bookings) {
        if (booking.status !== 'cancel') {
          const bookingDate = new Date(booking.sessionDate);
          console.log('bookingDate:', bookingDate, 'currentDate:', currentDate);
          let newStatus;
          if (bookingDate > currentDate) {
            newStatus = 'upcoming';
          } else {
            newStatus = 'completed';
          }
          await bookingsCollection.updateOne(
            { _id: booking._id },
            {
              $set: {
                status: newStatus
              }
            }
          );
          booking.status = newStatus;
        }
      }
      const tutorIds = bookings.map(
        booking => new ObjectId(booking.tutorId)
      );
      const tutors = await tutorsCollection
        .find({ _id: { $in: tutorIds } })
        .toArray();

      res.send({ bookings, tutors });
    });



    app.patch('/cancel-booking/:id', verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await bookingsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'cancel'
          }
        }
      );
      console.log(result,'rr');
      const tutor = await bookingsCollection.findOne({ _id: new ObjectId(id) });
      const tutorId = tutor?.tutorId;
      const updateResult = await tutorsCollection.updateOne(
        { _id: new ObjectId(tutorId) },
        {
          $inc: {
            slot: +1
          }
        }
      );
      res.send(result);
    });

    app.get('/tutors/email/:userEmail', verifyToken, async (req, res) => {
      const { userEmail } = req.params;
      const tutors = await tutorsCollection.find({
        userEmail
      }).toArray();
      res.send(tutors);
    });

    app.delete('/tutors/:id', async (req, res) => {
      const { id } = req.params;
      const result = await tutorsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });





    //await client.db("admin").command({ ping: 1 });
    //console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
