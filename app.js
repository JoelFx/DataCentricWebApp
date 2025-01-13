const express = require('express');
const mysql = require('mysql2');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const port = 3004;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', __dirname); // Set views to root directory

// MySQL Connection
const mysqlConnection = mysql.createConnection({
    host: 'localhost',
    user: 'root',  
    password: 'root',   
    database: 'proj2024mysql'
});

mysqlConnection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// MongoDB Connection
const mongoUrl = 'mongodb://localhost:27017';
const mongoDbName = 'proj2024MongoDB';
let mongoDb;

MongoClient.connect(mongoUrl)
    .then(client => {
        console.log('Connected to MongoDB');
        mongoDb = client.db(mongoDbName);
    })
    .catch(err => console.error('Error connecting to MongoDB:', err));

// Routes

// Home page
app.get('/', (req, res) => {
    res.render('index');
});

// Students list
app.get('/students', (req, res) => {
    const query = 'SELECT * FROM student ORDER BY sid';
    mysqlConnection.query(query, (err, results) => {
        if (err) throw err;
        res.render('students', { students: results });
    });
});

// Add student form
app.get('/students/add', (req, res) => {
    res.render('addStudent', { errors: [] });
});

// Add student post
app.post('/students/add', (req, res) => {
    const { sid, name, age } = req.body;
    const errors = [];

    // Validation
    if (!sid || sid.length !== 4) errors.push('Student ID must be 4 characters');
    if (!name || name.length < 2) errors.push('Name should be at least 2 characters');
    if (!age || age < 18) errors.push('Age should be 18 or older');

    if (errors.length > 0) {
        return res.render('addStudent', { errors, sid, name, age });
    }

    // Check if student exists
    mysqlConnection.query('SELECT * FROM student WHERE sid = ?', [sid], (err, results) => {
        if (err) throw err;
        
        if (results.length > 0) {
            errors.push(`Student ID ${sid} already exists`);
            return res.render('addStudent', { errors, sid, name, age });
        }

        // Insert new student
        const query = 'INSERT INTO student (sid, name, age) VALUES (?, ?, ?)';
        mysqlConnection.query(query, [sid, name, age], (err) => {
            if (err) throw err;
            res.redirect('/students');
        });
    });
});

// Edit student form
app.get('/students/edit/:sid', (req, res) => {
    const query = 'SELECT * FROM student WHERE sid = ?';
    mysqlConnection.query(query, [req.params.sid], (err, results) => {
        if (err) throw err;
        res.render('editStudent', { student: results[0], errors: [] });
    });
});

// Update student
app.post('/students/edit/:sid', (req, res) => {
    const { name, age } = req.body;
    const { sid } = req.params;
    const errors = [];

    // Validation
    if (!name || name.length < 2) errors.push('Name should be at least 2 characters');
    if (!age || age < 18) errors.push('Age should be 18 or older');

    if (errors.length > 0) {
        return res.render('editStudent', { student: { sid, name, age }, errors });
    }

    const query = 'UPDATE student SET name = ?, age = ? WHERE sid = ?';
    mysqlConnection.query(query, [name, age, sid], (err) => {
        if (err) throw err;
        res.redirect('/students');
    });
});

// Grades page
app.get('/grades', (req, res) => {
    const query = `
        SELECT s.name as student_name, m.name as module_name, g.grade 
        FROM student s 
        LEFT JOIN grade g ON s.sid = g.sid 
        LEFT JOIN module m ON g.mid = m.mid 
        ORDER BY s.name, g.grade`;
    
    mysqlConnection.query(query, (err, results) => {
        if (err) throw err;
        res.render('grades', { grades: results });
    });
});

// Lecturers page
app.get('/lecturers', async (req, res) => {
    try {
        const lecturers = await mongoDb.collection('lecturers')
            .find()
            .sort({ _id: 1 })
            .toArray();
        res.render('lecturers', { lecturers });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error retrieving lecturers');
    }
});

// Delete lecturer
app.get('/lecturers/delete/:lid', async (req, res) => {
    const lid = req.params.lid;
    
    // Check if lecturer teaches any modules
    mysqlConnection.query('SELECT * FROM module WHERE lecturer = ?', [lid], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            return res.render('error', { 
                message: `Cannot delete lecturer ${lid}. He/She has associated modules` 
            });
        }

        // Delete from MongoDB if no modules
        mongoDb.collection('lecturers')
            .deleteOne({ _id: lid })
            .then(() => res.redirect('/lecturers'))
            .catch(err => {
                console.error(err);
                res.status(500).send('Error deleting lecturer');
            });
    });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});