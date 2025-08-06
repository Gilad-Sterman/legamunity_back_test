// This script assigns admin privileges to a user in Firebase.
// Usage: node scripts/setAdmin.js <user_email>

const admin = require('../src/config/firebase');

const email = process.argv[2];

if (!email) {
  console.error('Error: Please provide a user email as an argument.');
  process.exit(1);
}

const setAdminClaim = async (email) => {
  try {
    // Get the user by email
    const user = await admin.auth().getUserByEmail(email);

    // Set the custom claim for admin role
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    console.log(`Success! ${email} has been granted admin privileges.`);
    process.exit(0);
  } catch (error) {
    console.error(`Error setting admin claim for ${email}:`, error.message);
    process.exit(1);
  }
};

setAdminClaim(email);
