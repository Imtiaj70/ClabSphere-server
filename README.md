🚀 ClubSphere Server

Backend API for ClubSphere, a full-stack MERN application that helps users discover, join, and manage local clubs and events.

This server handles authentication, role-based authorization, club & event management, membership payments, and Stripe integration.

🌍 Live Project

Client: https://clabspare.web.app/

Client Repository: https://github.com/Imtiaj70/ClabSphere-client

Server Repository: https://github.com/Imtiaj70/ClabSphere-server

🧱 Tech Stack

Node.js

Express.js

MongoDB

Firebase Admin SDK

JWT (JSON Web Token)

Stripe (Test Mode)

CORS

dotenv

📦 NPM Packages Used
express
mongodb
cors
dotenv
jsonwebtoken
stripe
firebase-admin

🗂️ Database Collections

The backend uses the following MongoDB collections:

users

clubs

memberships

events

eventRegistrations

payments

Each collection is structured with proper references and role-based access control.

🔐 Authentication & Security

Firebase Authentication (handled on client)

Firebase Admin SDK for token verification

JWT issued after login

Role-based middleware protection

Secure environment variables for:

MongoDB credentials

Firebase Admin credentials

Stripe secret key

JWT secret

👥 User Roles
Admin

Approve or reject club requests

Manage users and roles

Monitor clubs, events, and payments

View platform statistics

Club Manager

Create and manage clubs

Set membership fee (free or paid)

Create, update, delete events

View club members

View revenue overview

Member

Join clubs

Pay membership fees via Stripe

Register for events

View joined clubs and payment history

💳 Stripe Integration

Stripe is used in Test Mode

Secure payment intent creation

Membership and event payments stored in payments collection

Payment status validated before confirming registration

🔒 Environment Variables

Create a .env file in the root directory:

PORT=5000

DB_USER=your_mongodb_user
DB_PASS=your_mongodb_password

JWT_SECRET=your_jwt_secret

STRIPE_SECRET_KEY=your_stripe_secret_key

FB_SERVICE_KEY=your_base64_encoded_firebase_service_key


⚠️ Never expose your .env file in GitHub.

⚙️ Installation & Setup
1️⃣ Clone the Repository
git clone https://github.com/Imtiaj70/ClabSphere-server.git
cd ClabSphere-server

2️⃣ Install Dependencies
npm install

3️⃣ Run the Server
npm start


For development:

nodemon index.js


Server will run on:

http://localhost:5000

📡 Core API Features

User registration & role management

JWT token generation

Firebase token verification middleware

Club CRUD operations

Event CRUD operations

Membership handling

Stripe payment intent creation

Payment record storage

Admin role-based protected routes

✅ Deployment Checklist

Environment variables configured

MongoDB Atlas connected

CORS configured properly

Firebase Admin key encoded

Stripe secret key added

All protected routes verified

No production 404 or CORS issues

👨‍💻 Author

Imtiaj Uddin
Project: ClubSphere
Type: Full-Stack MERN Application
