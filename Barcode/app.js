const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Failed to connect to database:', err.message);
    else console.log('Connected to SQLite database.');
});

db.run('CREATE TABLE IF NOT EXISTS barcodes (id INTEGER PRIMARY KEY AUTOINCREMENT, barcode TEXT, name TEXT, quantity INTEGER DEFAULT 1, occupant TEXT DEFAULT None)');
db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT)');
db.run(`
    CREATE TABLE IF NOT EXISTS items_assigned (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        barcode_id INTEGER,
        name TEXT,
        barcode Text,
        Quantity TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (barcode_id) REFERENCES barcodes(id)
    )
`);

app.post('/save', (req, res) => {
    const { barcode, name } = req.body;

    if (!barcode || !name) {
        return res.status(400).json({ error: 'Barcode and name are required' });
    }

    db.run('INSERT INTO barcodes (barcode, name) VALUES (?, ?)', [barcode, name], (err) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ success: true });
    });
});


app.get('/barcodes', (req, res) => {
    db.all('SELECT id, barcode, name, quantity, occupant FROM barcodes', [], (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows); // Send the rows as JSON
    });
});

app.post('/check', (req, res) => {
    const { barcode } = req.body;

    if (!barcode) {
        return res.status(400).json({ error: 'Barcode is required' });
    }

    // Check if the barcode already exists in the database
    db.get('SELECT id, barcode, quantity FROM barcodes WHERE barcode = ?', [barcode], (err, row) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (row) {
            // Barcode exists, return the current quantity
            db.run('UPDATE barcodes SET quantity = quantity + 1 WHERE barcode = ?', [barcode]);
            return res.status(200).json({ exists: true, quantity: row.quantity });
        } else {
            // Barcode doesn't exist
            return res.status(404).json({ exists: false });
        }
    });
});

app.post('/search', (req, res) => {
    const { barcode } = req.body; 

    if (!barcode) {
        return res.status(400).json({ error: 'Barcode is required' });
    }

    db.all('SELECT id, barcode, name, quantity, occupant FROM barcodes WHERE barcode LIKE ?', [barcode], (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (rows.length === 0) {
            // Return a 404 if no matching rows are found
            return res.status(404).json({ error: 'No items found with that barcode' });
        }

        // Return the rows as JSON
        res.json(rows);
    });
});

app.post('/delete', (req, res) => {
    const { barcode } = req.body;

    if (!barcode) {
        return res.status(400).json({ error: 'Barcode is required' });
    }

    db.all('DELETE FROM barcodes WHERE barcode LIKE ?', [barcode], (err) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json({ success: true });
    });
});

app.post('/take', (req, res) => {

    const { barcode, occupant } = req.body;

    if (!barcode || !occupant) {
        return res.status(400).json({ error: 'Barcode and occupant are required' });
    }

    db.run('UPDATE barcodes SET occupant = ? WHERE barcode LIKE ?', [occupant, barcode], (err) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json({ success: true });
    });
});


app.get('/get-assigned-items', (req, res) => {
    const query = `
        SELECT users.name AS user_name, 
               items_assigned.name AS item_name, 
               items_assigned.barcode AS barcode, 
               items_assigned.Quantity AS quantity
        FROM items_assigned
        JOIN users ON items_assigned.user_id = users.id
        ORDER BY users.name;
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            const groupedData = rows.reduce((acc, row) => {
                if (!acc[row.user_name]) acc[row.user_name] = [];
                acc[row.user_name].push({
                    item_name: row.item_name,
                    barcode: row.barcode,
                    quantity: row.quantity,
                });
                return acc;
            }, {});
            res.json(groupedData);
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});