const bcrypt = require('bcryptjs');

// The password you want to hash
const password = "Sufyan@123";

// 1. Define the salt rounds (the "cost factor" from your example)
const saltRounds = 10;

// 2. Generate the salt and hash in one step
// The .hash() method automatically generates a salt and hashes the password.
bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
    if (err) {
        console.error("Error hashing password:", err);
        return;
    }
    
    // This is the hash you store in your database
    console.log(hashedPassword);
});