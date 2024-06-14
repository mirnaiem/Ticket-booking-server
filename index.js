const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const jwt=require('jsonwebtoken')
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

function createToken(user){
  const token= jwt.sign(
     {
     email: user.email
   }, 
   'secret', 
   { expiresIn: '1h' });
   return token
 }
 function verifyToken(req,res,next){
   const token=req.headers.authorization.split(' ')[1]
   const verify=jwt.verify(token,'secret');
   if(!verify?.email){
     return res.send('You are not authorized')
   }
 req.user=verify.email
   next()
 }
 

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@easy-education.2faznqa.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    await client.connect();
    const ticketDB = client.db('ticketDB');
    const eventCollection = ticketDB.collection('eventCollection');
    const bookingCollection = ticketDB.collection('bookingCollection');
    const userCollection = ticketDB.collection('userCollection');

    // Get all events
    app.get('/events', async (req, res) => {
      const events = eventCollection.find();
      const result = await events.toArray();
      res.send(result);
    });

    // Get event by ID
    app.get('/events/:id', async (req, res) => {
      const eventId = req.params.id;
      const eventData = await eventCollection.findOne({ _id: new ObjectId(eventId) });
      res.send(eventData);
    });

    // Create a payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { amount, currency } = req.body;
      if (amount < 0.50) {
        return res.status(400).send({ error: "Amount must be at least $0.50" });
      }
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), 
          currency: currency || 'usd', 
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(400).send({ error: error.message });
      }
    });

    // Handle booking
    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      try {
        
        const result = await bookingCollection.insertOne(booking);

        await eventCollection.updateOne(
          { _id: new ObjectId(booking.eventId) },
          { $inc: { availableTickets: -booking.numberOfTickets } }
        );

        res.send(result);
      } catch (error) {
        res.status(400).send({ error: error.message });
      }
    });
    // user data
    app.post('/users',async(req,res)=>{
      const user=req.body;
      const token=createToken(user)
      console.log(token);
      const isUserExist=await userCollection.findOne({email:user?.email});
      if(isUserExist?._id){
       return res.send({
        status:'success',
        message:"login success",
        token
       })
      }
      await userCollection.insertOne(user);
      res.send({token})
      
    })
    console.log("Connected to MongoDB!");
  } finally {
    // Ensure proper cleanup if needed
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello Global!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
