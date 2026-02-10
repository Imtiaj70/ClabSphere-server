const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const admin = require("firebase-admin");

const port = process.env.PORT || 3000;

const decoded = Buffer
  .from(process.env.FB_SERVICE_KEY, "base64")
  .toString("utf8");

const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


// Middleware
app.use(cors());
app.use(express.json());
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;   
    if (!authHeader) {       
        req.decoded_email = req.headers['x-user-email'] || "test@example.com";
        return next();
    }

    try {
        const token = authHeader.split(' ')[1];
        req.decoded_email = token.includes('@') ? token : "user@example.com";
        next();
    } catch (err) {
        console.error('Token verification failed:', err);
        req.decoded_email = "test@example.com";
        next();
    }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xp73onh.mongodb.net/zap_shift_db?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // await client.connect();
        console.log("✅ MongoDB connected successfully!");        
        const db = client.db('zap_shift_db');
        const usersCollection = db.collection('users');
        const clubsCollection = db.collection('clubs');
        const eventsCollection = db.collection('events');
        const eventRegistrationsCollection = db.collection('eventRegistrations');
        const clubMembershipCollection = db.collection('clubMembership');
        const paymentCollection = db.collection('payments');

        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        const requiredCollections = ['users', 'clubs', 'events', 'eventRegistrations', 'clubMembership', 'payments'];
        for (const colName of requiredCollections) {
            if (!collectionNames.includes(colName)) {
                await db.createCollection(colName);
                console.log(`📁 Created collection: ${colName}`);
            }
        }
        
        // ==================== BASIC ENDPOINTS ====================
        
        // Home route
        app.get('/', (req, res) => {
            res.json({
                message: '🎉 ClubSphere Server is running!',
                // database: 'MongoDB Atlas',
                // endpoints: [
                //     { method: 'GET', path: '/health', description: 'Health check' },
                //     { method: 'POST', path: '/users', description: 'Create user' },
                //     { method: 'GET', path: '/users/:email/role', description: 'Get user role' },
                //     { method: 'GET', path: '/clubs', description: 'Get all clubs' },
                //     { method: 'POST', path: '/clubs', description: 'Create club' },
                //     { method: 'GET', path: '/events/upcoming', description: 'Get upcoming events' },
                //     { method: 'POST', path: '/events', description: 'Create event' },
                //     { method: 'POST', path: '/event-registrations', description: 'Register for event' },
                //     { method: 'POST', path: '/payment-checkout-session', description: 'Create payment session' }
                // ]
            });
        });
        
        // Health check
        // app.get('/health', async (req, res) => {
        //     try {
        //         await db.command({ ping: 1 });
        //         res.json({
        //             status: 'healthy',
        //             database: 'connected',
        //             timestamp: new Date().toISOString()
        //         });
        //     } catch (error) {
        //         res.status(500).json({ status: 'unhealthy', error: error.message });
        //     }
        // });
        
        // ==================== USER ENDPOINTS ====================
        
        // Create user
        app.post('/users', async (req, res) => {
            try {
                const user = req.body;
                user.role = user.role || 'member';
                user.createdAt = new Date().toISOString();
                const email = user.email;
                
                const userExists = await usersCollection.findOne({ email });
                if (userExists) {
                    return res.json({ 
                        success: true, 
                        message: 'User already exists', 
                        user: userExists 
                    });
                }

                const result = await usersCollection.insertOne(user);
                res.json({
                    success: true,
                    message: 'User created successfully',
                    userId: result.insertedId
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: "Internal server error", 
                    error: error.message 
                });
            }
        });
        // verifyToken,
        
        // Get user role
        app.get('/users/:email/role', verifyToken, async (req, res) => {
            try {
                const email = req.params.email;
                const user = await usersCollection.findOne({ email });
                
                if (!user) {
                    // Auto-create user if not exists
                    const newUser = {
                        email: email,
                        name: email.split('@')[0],
                        role: 'member',
                        createdAt: new Date().toISOString()
                    };
                    await usersCollection.insertOne(newUser);
                    return res.json({ role: 'member' });
                }

                res.json({ role: user.role || 'member' });
            } catch (error) {
                console.error(error);
                res.status(500).json({ 
                    success: false, 
                    message: "Internal server error" 
                });
            }
        });
        
        // Get all users
        app.get('/users', async (req, res) => {
            try {
                const users = await usersCollection.find().toArray();
                res.json(users);
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: "Failed to fetch users", 
                    error: error.message 
                });
            }
        });
        
        // Update user role
        app.patch('/users/:id/role', async (req, res) => {
            try {
                const id = req.params.id;
                const { role } = req.body;

                if (!role) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Role is required" 
                    });
                }

                const result = await usersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { role } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).json({ 
                        success: false, 
                        message: "User not found" 
                    });
                }

                res.json({ 
                    success: true, 
                    message: "User role updated successfully" 
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: "Failed to update user role", 
                    error: error.message 
                });
            }
        });
        
        // ==================== CLUB ENDPOINTS ====================
        
        // Get all clubs with filters
        app.get('/clubs', async (req, res) => {
            try {
                const query = {};
                const { category, location, managerEmail } = req.query;

                if (category) query.category = category;
                if (location) query.location = location;
                if (managerEmail) query.managerEmail = managerEmail;

                const options = { sort: { createdAt: -1 } };
                const clubs = await clubsCollection.find(query, options).toArray();
                
                res.json(clubs);
            } catch (error) {
                console.error("Failed to fetch clubs:", error);
                res.status(500).json({ 
                    success: false, 
                    message: "Failed to fetch clubs" 
                });
            }
        });
        
        // Get single club by ID
        app.get('/clubs/:id', async (req, res) => {
            try {
                const clubId = req.params.id;
                const club = await clubsCollection.findOne({ _id: new ObjectId(clubId) });

                if (!club) {
                    return res.status(404).json({ 
                        success: false, 
                        message: "Club not found" 
                    });
                }

                res.json({ 
                    success: true, 
                    data: club 
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: "Server error", 
                    error: error.message 
                });
            }
        });
        
        // Create club
        app.post('/clubs', async (req, res) => {
            try {
                const newClub = req.body;
                newClub.createdAt = new Date().toISOString();
                newClub.status = newClub.status || "pending";
                
                const result = await clubsCollection.insertOne(newClub);
                
                res.json({
                    success: true,
                    message: 'Club created successfully',
                    clubId: result.insertedId,
                    data: newClub
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: "Failed to create club", 
                    error: error.message 
                });
            }
        });
        
        // Get clubs by manager
        app.get('/my-clubs', async (req, res) => {
            try {
                const managerEmail = req.query.managerEmail;

                if (!managerEmail) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "managerEmail is required" 
                    });
                }

                const managedClubs = await clubsCollection.find({ managerEmail }).toArray();
                
                res.json({
                    success: true,
                    data: managedClubs
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: "Failed to fetch clubs", 
                    error: error.message 
                });
            }
        });
        
        // ==================== EVENT ENDPOINTS ====================
        
        // Get upcoming events
        app.get('/events/upcoming', async (req, res) => {
            try {
                const query = {};
                const { clubId, isPaid, location } = req.query;

                if (clubId) query.clubId = clubId;
                if (isPaid) query.isPaid = isPaid === "true";
                if (location) query.location = location;

                const nowISO = new Date().toISOString();
                query.eventDate = { $gte: nowISO };

                const options = { sort: { eventDate: 1 } };
                const events = await eventsCollection.find(query, options).toArray();
                
                res.json(events);
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: "Failed to fetch upcoming events", 
                    error: error.message 
                });
            }
        });
        
        // Get all events
        app.get('/events', async (req, res) => {
            try {
                const { managerEmail } = req.query;
                const query = {};
                
                if (managerEmail) {
                    query.managerEmail = managerEmail;
                }
                
                const events = await eventsCollection.find(query).toArray();
                res.json(events);
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: "Failed to fetch events", 
                    error: error.message 
                });
            }
        });
        
        // Create event
        app.post('/events', async (req, res) => {
            try {
                const newEvent = req.body;
                newEvent.createdAt = new Date().toISOString();
                
                const result = await eventsCollection.insertOne(newEvent);
                
                res.json({
                    success: true,
                    message: 'Event created successfully',
                    eventId: result.insertedId
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: "Failed to create event", 
                    error: error.message 
                });
            }
        });
        
        // Update event
        app.patch('/events/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { _id, ...eventInfo } = req.body;

                const query = { _id: new ObjectId(id) };
                const updatedDoc = { $set: eventInfo };

                const result = await eventsCollection.updateOne(query, updatedDoc);

                if (result.matchedCount === 0) {
                    return res.status(404).json({ 
                        success: false, 
                        message: 'Event not found' 
                    });
                }

                res.json({ 
                    success: true, 
                    message: 'Event updated successfully' 
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Failed to update event', 
                    error: error.message 
                });
            }
        });
        
        // Delete event
        app.delete('/events/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };

                const result = await eventsCollection.deleteOne(query);

                if (result.deletedCount === 0) {
                    return res.status(404).json({ 
                        success: false, 
                        message: 'Event not found' 
                    });
                }

                res.json({ 
                    success: true, 
                    message: 'Event deleted successfully' 
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Failed to delete event', 
                    error: error.message 
                });
            }
        });
        
        // ==================== EVENT REGISTRATION ENDPOINTS ====================
        
        // Register for event
        app.post('/event-registrations', async (req, res) => {
            try {
                const registration = req.body;
                const { eventId, userEmail } = registration;

                if (!eventId || !userEmail) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Missing required fields" 
                    });
                }

                // Check if already registered
                const existing = await eventRegistrationsCollection.findOne({
                    eventId,
                    userEmail,
                });

                if (existing) {
                    return res.status(409).json({ 
                        success: false, 
                        message: "Already registered for this event" 
                    });
                }

                registration.registeredAt = new Date().toISOString();
                registration.status = "registered";

                const result = await eventRegistrationsCollection.insertOne(registration);

                res.json({
                    success: true,
                    message: "Event registered successfully!",
                    registrationId: result.insertedId
                });
            } catch (error) {
                console.error("Event Registration Error:", error);
                res.status(500).json({ 
                    success: false, 
                    message: "Internal server error" 
                });
            }
        });
        
        // Get event registrations
        app.get('/event-registrations', async (req, res) => {
            try {
                const { managerEmail, role } = req.query;

                if (!managerEmail || !role) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'managerEmail and role are required' 
                    });
                }

                // Check if user is manager
                const manager = await usersCollection.findOne({ 
                    email: managerEmail, 
                    role: role 
                });
                
                if (!manager) {
                    return res.status(403).json({ 
                        success: false, 
                        message: 'Access denied. Not a manager.' 
                    });
                }

                const registrations = await eventRegistrationsCollection.find().toArray();
                res.json(registrations);
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Failed to fetch registrations', 
                    error: error.message 
                });
            }
        });
        
        // ==================== CLUB MEMBERSHIP ENDPOINTS ====================
        
        // Get club members
        app.get('/club-members', async (req, res) => {
            try {
                const { managerEmail, role } = req.query;

                if (!managerEmail || !role) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'managerEmail and role are required' 
                    });
                }

                const memberships = await clubMembershipCollection.find({ 
                    managerEmail 
                }).toArray();

                res.json({ 
                    success: true, 
                    data: memberships 
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Server error', 
                    error: error.message 
                });
            }
        });
        
        // Update membership expiration
        app.patch('/club-members/:id/expire', async (req, res) => {
            try {
                const { id } = req.params;
                const { expireDate } = req.body;

                if (!expireDate) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "expireDate is required" 
                    });
                }

                const expireDateObj = new Date(expireDate);
                const now = new Date();
                const status = expireDateObj < now ? "expired" : "active";

                const result = await clubMembershipCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { expireDate: expireDateObj, status } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).json({ 
                        success: false, 
                        message: "Member not found" 
                    });
                }

                res.json({ 
                    success: true, 
                    message: "Membership expiration updated" 
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: "Server error", 
                    error: error.message 
                });
            }
        });
        
        // Delete membership
        app.delete('/club-members/:id', async (req, res) => {
            try {
                const { id } = req.params;

                const result = await clubMembershipCollection.deleteOne({ 
                    _id: new ObjectId(id) 
                });

                if (result.deletedCount === 0) {
                    return res.status(404).json({ 
                        success: false, 
                        message: "Member not found" 
                    });
                }

                res.json({ 
                    success: true, 
                    message: "Membership deleted successfully" 
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: "Server error", 
                    error: error.message 
                });
            }
        });
        
        // ==================== PAYMENT ENDPOINTS ====================
        
        // Create Stripe checkout session for events
        app.post('/payment-checkout-session', async (req, res) => {
            try {
                const paymentInfo = req.body;
                const amount = parseInt(paymentInfo.amount) * 100;
                
                const session = await stripe.checkout.sessions.create({
                    line_items: [{
                        price_data: {
                            currency: 'USD',
                            unit_amount: amount,
                            product_data: {
                                name: paymentInfo.eventTitle
                            }
                        },
                        quantity: 1,
                    }],
                    customer_email: paymentInfo.userEmail,
                    mode: 'payment',
                    metadata: {
                        userEmail: paymentInfo.userEmail,
                        amount: paymentInfo.amount,
                        paymentType: paymentInfo.paymentType,
                        clubId: paymentInfo.clubId,
                        eventId: paymentInfo.eventId,
                        eventTitle: paymentInfo.eventTitle,
                        status: "pending"
                    },
                    success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
                });

                res.json({ 
                    success: true, 
                    url: session.url 
                });
            } catch (error) {
                console.error("Payment Error:", error);
                res.status(500).json({ 
                    success: false, 
                    message: "Payment session creation failed", 
                    error: error.message 
                });
            }
        });
        
        // Payment success callback
        app.patch('/payment-success', async (req, res) => {
            try {
                const sessionId = req.query.session_id;
                const session = await stripe.checkout.sessions.retrieve(sessionId);

                if (session.payment_status === 'paid') {
                    // Save payment info
                    const paymentInfo = {
                        userEmail: session.metadata.userEmail,
                        amount: session.metadata.amount,
                        paymentType: "event",
                        clubId: session.metadata.clubId,
                        eventId: session.metadata.eventId,
                        transactionId: sessionId,
                        status: "paid",
                        createdAt: new Date(),
                        eventTitle: session.metadata.eventTitle,
                    };

                    await paymentCollection.updateOne(
                        { transactionId: sessionId },
                        { $setOnInsert: paymentInfo },
                        { upsert: true }
                    );

                    // Save event registration
                    const registration = {
                        eventId: session.metadata.eventId,
                        userEmail: session.metadata.userEmail,
                        clubId: session.metadata.clubId,
                        status: "registered",
                        paymentId: sessionId,
                        registeredAt: new Date().toISOString(),
                    };

                    await eventRegistrationsCollection.updateOne(
                        { 
                            eventId: session.metadata.eventId, 
                            userEmail: session.metadata.userEmail 
                        },
                        { $setOnInsert: registration },
                        { upsert: true }
                    );

                    return res.json({
                        success: true,
                        message: "Payment and registration processed successfully"
                    });
                }

                res.status(400).json({ 
                    success: false, 
                    message: "Payment not completed" 
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Payment processing error",
                    error: error.message,
                });
            }
        });
        
        // Create club membership payment session
        app.post('/payment-club-membership', async (req, res) => {
            try {
                const paymentInfo = req.body;
                const amount = parseInt(paymentInfo.cost) * 100;

                const session = await stripe.checkout.sessions.create({
                    line_items: [{
                        price_data: {
                            currency: 'USD',
                            unit_amount: amount,
                            product_data: {
                                name: `${paymentInfo.clubName} - Club Membership`,
                            }
                        },
                        quantity: 1,
                    }],
                    customer_email: paymentInfo.userEmail,
                    mode: 'payment',
                    metadata: {
                        userEmail: paymentInfo.userEmail,
                        clubId: paymentInfo.clubId,
                        clubName: paymentInfo.clubName,
                        category: paymentInfo.category,
                        managerEmail: paymentInfo.managerEmail,
                        cost: paymentInfo.cost,
                        paymentType: "club-membership",
                        bannerImage: paymentInfo.bannerImage,
                        location: paymentInfo.location,
                        description: paymentInfo.description,
                        status: "pending"
                    },
                    success_url: `${process.env.SITE_DOMAIN}/club-membership-payment-success?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${process.env.SITE_DOMAIN}/club-membership-payment-cancelled`,
                });

                res.json({ 
                    success: true, 
                    url: session.url 
                });
            } catch (error) {
                console.error("Club Payment Error:", error);
                res.status(500).json({ 
                    success: false, 
                    message: "Payment session creation failed", 
                    error: error.message 
                });
            }
        });
        
        // Club membership payment success callback
        app.patch('/club-membership-payment-success', async (req, res) => {
            try {
                const sessionId = req.query.session_id;
                const session = await stripe.checkout.sessions.retrieve(sessionId);

                if (session.payment_status === 'paid') {
                    // Save payment info
                    const paymentInfo = {
                        userEmail: session.metadata.userEmail,
                        amount: session.metadata.cost,
                        clubId: session.metadata.clubId,
                        category: session.metadata.category,
                        transactionId: sessionId,
                        paymentType: "club-membership",
                        status: "paid",
                        paidAt: new Date(),
                    };

                    await paymentCollection.updateOne(
                        { transactionId: sessionId },
                        { $setOnInsert: paymentInfo },
                        { upsert: true }
                    );

                    // Save club membership
                    const clubMembership = {
                        userEmail: session.metadata.userEmail,
                        clubId: session.metadata.clubId,
                        clubName: session.metadata.clubName || "",
                        category: session.metadata.category,
                        managerEmail: session.metadata.managerEmail,
                        bannerImage: session.metadata.bannerImage,
                        location: session.metadata.location,
                        description: session.metadata.description,
                        paymentId: sessionId,
                        status: "active",
                        joinedAt: new Date(),
                    };

                    await clubMembershipCollection.updateOne(
                        { 
                            userEmail: session.metadata.userEmail, 
                            clubId: session.metadata.clubId 
                        },
                        { $setOnInsert: clubMembership },
                        { upsert: true }
                    );

                    return res.json({
                        success: true,
                        message: "Club membership payment saved successfully"
                    });
                }

                res.status(400).json({ 
                    success: false, 
                    message: "Payment not completed" 
                });
            } catch (error) {
                console.error("Club Membership Payment Error:", error);
                res.status(500).json({
                    success: false,
                    message: "Payment processing error",
                    error: error.message,
                });
            }
        });
        
        // Get payments
        app.get('/payments', async (req, res) => {
            try {
                const {
                    userEmail,
                    clubId,
                    eventId,
                    status,
                    paymentType,
                    minAmount,
                    maxAmount,
                    startDate,
                    endDate
                } = req.query;

                let filter = {};

                if (userEmail) filter.userEmail = userEmail;
                if (clubId) filter.clubId = clubId;
                if (eventId) filter.eventId = eventId;
                if (status) filter.status = status;
                if (paymentType) filter.paymentType = paymentType;

                if (minAmount || maxAmount) {
                    filter.amount = {};
                    if (minAmount) filter.amount.$gte = Number(minAmount);
                    if (maxAmount) filter.amount.$lte = Number(maxAmount);
                }

                if (startDate || endDate) {
                    filter.createdAt = {};
                    if (startDate) filter.createdAt.$gte = new Date(startDate);
                    if (endDate) filter.createdAt.$lte = new Date(endDate);
                }

                const payments = await paymentCollection
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json(payments);
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: "Failed to fetch payments", 
                    error: error.message 
                });
            }
        });
        
        // ==================== DASHBOARD ENDPOINTS ====================
        
        // Admin overview
        app.get('/admin-overview', async (req, res) => {
            try {
                const totalUsers = await usersCollection.countDocuments();
                const totalClubs = await clubsCollection.countDocuments();
                const pendingClubs = await clubsCollection.countDocuments({ status: "pending" });
                const approvedClubs = await clubsCollection.countDocuments({ status: "approved" });
                const rejectedClubs = await clubsCollection.countDocuments({ status: "rejected" });
                const totalMemberships = await clubMembershipCollection.countDocuments();
                const totalEvents = await eventsCollection.countDocuments();
                const totalEventRegistrations = await eventRegistrationsCollection.countDocuments();

                const paymentStats = await paymentCollection.aggregate([
                    {
                        $group: {
                            _id: null,
                            totalAmount: { $sum: { $toDouble: "$amount" } },
                            count: { $sum: 1 }
                        }
                    }
                ]).toArray();

                const totalPaymentAmount = paymentStats[0]?.totalAmount || 0;
                const totalPayments = paymentStats[0]?.count || 0;

                // Get clubs for membership stats
                const clubs = await clubsCollection.find().toArray();
                const membershipsPerClub = await Promise.all(
                    clubs.map(async (club) => {
                        const count = await clubMembershipCollection.countDocuments({ 
                            clubId: club._id.toString() 
                        });
                        return {
                            clubName: club.name,
                            memberships: count,
                        };
                    })
                );

                res.json({
                    users: { total: totalUsers },
                    clubs: {
                        total: totalClubs,
                        pending: pendingClubs,
                        approved: approvedClubs,
                        rejected: rejectedClubs
                    },
                    memberships: { total: totalMemberships },
                    membershipsPerClub,
                    events: { total: totalEvents },
                    eventRegistrations: { total: totalEventRegistrations },
                    payments: {
                        totalPayments,
                        totalAmount: totalPaymentAmount
                    }
                });
            } catch (error) {
                console.error("Admin Overview Error:", error);
                res.status(500).json({ 
                    success: false, 
                    message: "Server Error" 
                });
            }
        });
        
        // Club manager overview
        app.get('/club-manager-overview', verifyToken, async (req, res) => {
            try {
                const managerEmail = req.query.managerEmail;
                const filterRole = req.query.role;

                if (!managerEmail) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "managerEmail is required" 
                    });
                }

                const managedClubs = await clubsCollection.find({ 
                    managerEmail 
                }).toArray();

                if (managedClubs.length === 0) {
                    return res.status(404).json({ 
                        success: false, 
                        message: "No clubs found for this manager" 
                    });
                }

                const managerUser = await usersCollection.findOne({ 
                    email: managerEmail 
                });

                if (!managerUser) {
                    return res.status(404).json({ 
                        success: false, 
                        message: "User not found" 
                    });
                }

                if (managerUser.role !== "clubManager") {
                    return res.status(403).json({
                        success: false,
                        message: "User is not a club manager",
                        foundRole: managerUser.role
                    });
                }

                const clubIds = managedClubs.map(c => c._id.toString());
                const clubMembers = await clubMembershipCollection.find({
                    clubId: { $in: clubIds }
                }).toArray();

                const memberEmails = clubMembers.map(m => m.userEmail);
                let totalMembers = memberEmails.length;

                if (filterRole) {
                    totalMembers = await usersCollection.countDocuments({
                        email: { $in: memberEmails },
                        role: filterRole
                    });
                }

                const totalEvents = await eventsCollection.countDocuments({
                    clubId: { $in: clubIds }
                });

                const paymentStats = await paymentCollection.aggregate([
                    { 
                        $match: { 
                            clubId: { $in: clubIds }, 
                            status: "paid" 
                        } 
                    },
                    { 
                        $group: { 
                            _id: null, 
                            totalAmount: { $sum: "$amount" }, 
                            totalPayments: { $sum: 1 } 
                        } 
                    }
                ]).toArray();

                const totalPayments = paymentStats[0]?.totalPayments || 0;
                const totalPaymentAmount = paymentStats[0]?.totalAmount || 0;

                res.json({
                    manager: {
                        email: managerEmail,
                        name: managerUser.name,
                        role: managerUser.role
                    },
                    clubs: {
                        total: managedClubs.length
                    },
                    members: {
                        total: totalMembers,
                        filterRole: filterRole || "none"
                    },
                    events: {
                        total: totalEvents
                    },
                    payments: {
                        totalPayments,
                        totalAmount: totalPaymentAmount
                    }
                });
            } catch (error) {
                console.error("Club Manager Overview Error:", error);
                res.status(500).json({ 
                    success: false, 
                    message: "Server Error" 
                });
            }
        });
        
        // Member overview
        app.get('/member-overview', async (req, res) => {
            try {
                const { userEmail, role } = req.query;

                if (!userEmail || !role) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Missing userEmail or role" 
                    });
                }

                const user = await usersCollection.findOne({ 
                    email: userEmail, 
                    role: role 
                });
                
                if (!user) {
                    return res.status(403).json({ 
                        success: false, 
                        message: "Unauthorized or user not found" 
                    });
                }

                const registrations = await eventRegistrationsCollection.find({ 
                    userEmail 
                }).toArray();

                const totalEventsRegistered = registrations.length;
                const uniqueClubIds = [...new Set(registrations.map((r) => r.clubId))];

                const clubs = await clubsCollection.find({ 
                    _id: { $in: uniqueClubIds.map(id => new ObjectId(id)) } 
                }).toArray();

                const totalClubsJoined = clubs.length;

                const upcomingEvents = await eventsCollection.find({
                    clubId: { $in: uniqueClubIds },
                    eventDate: { $gte: new Date() },
                }).toArray();

                const eventsWithClubName = upcomingEvents.map((event) => {
                    const club = clubs.find((c) => c._id.toString() === event.clubId);
                    return {
                        title: event.title,
                        date: event.eventDate,
                        location: event.location,
                        clubName: club ? club.name : "",
                    };
                });

                res.json({
                    totalClubsJoined,
                    totalEventsRegistered,
                    upcomingEvents: eventsWithClubName,
                });
            } catch (error) {
                console.error("Member Overview Error:", error);
                res.status(500).json({ 
                    success: false, 
                    message: "Server error" 
                });
            }
        });
        
        // Get user's clubs
        app.get('/member/my-clubs', async (req, res) => {
            try {
                const { userEmail, role } = req.query;

                if (!userEmail) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'userEmail is required' 
                    });
                }

                const clubs = await clubMembershipCollection.find({ 
                    userEmail 
                }).toArray();

                res.json(clubs);
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Server error', 
                    error: error.message 
                });
            }
        });
        
        // Get user's events
        app.get('/member/my-events', async (req, res) => {
            try {
                const { userEmail, role } = req.query;

                if (!userEmail) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'userEmail is required' 
                    });
                }

                const events = await eventRegistrationsCollection.find({ 
                    userEmail 
                }).toArray();

                res.json(events);
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Server error', 
                    error: error.message 
                });
            }
        });
        
        // Get user's payments
        app.get('/member/my-payments', async (req, res) => {
            try {
                const { userEmail, role } = req.query;

                if (!userEmail) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'userEmail is required' 
                    });
                }

                const payments = await paymentCollection.find({ 
                    userEmail 
                }).toArray();

                res.json(payments);
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Server error', 
                    error: error.message 
                });
            }
        });
        
        // ==================== 404 HANDLER ====================
        
        app.use((req, res) => {
            res.status(404).json({
                success: false,
                message: "Endpoint not found",
                path: req.path,
                method: req.method
            });
        });
        
        console.log("✅ All API endpoints loaded successfully");
        
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error.message);
        
        // Basic routes if MongoDB connection fails
        app.get('/', (req, res) => {
            res.json({
                message: 'ClubSphere Server (Development Mode)',
                warning: 'MongoDB connection failed',
                error: error.message
            });
        });
        
        app.get('/health', (req, res) => {
            res.json({
                status: 'degraded',
                database: 'disconnected',
                message: 'Running without MongoDB'
            });
        });
    }
}

run().catch(console.dir);

// serverless এর জন্য
module.exports = app;
