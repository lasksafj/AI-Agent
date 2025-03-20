const { Pool } = require('pg');
require('dotenv').config();

// Database connection setup
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Query function to interact with the database
const query = async (text, params) => {
    const client = await pool.connect();
    try {
        const res = await client.query(text, params);
        return res.rows;
    } catch (err) {
        console.error("Database query error:", err);
        throw err;
    } finally {
        client.release();
    }
};

// Export database functions
module.exports = {
    query,

    // Get available slots
    getAvailableSlots: async () => {
        return await query("SELECT * FROM schedule WHERE is_reserved = false");
    },

    // Create a new customer
    createCustomer: async (name, phone, email) => {
        return await query(
            "INSERT INTO customers (name, phone, email) VALUES ($1, $2, $3) RETURNING *",
            [name, phone, email]
        );
    },

    // Get services
    getServices: async () => {
        return await query("SELECT * FROM services");
    },

    // Create a new appointment
    createAppointment: async (customer_id, service_id, date, time) => {
        const available = await query("SELECT * FROM schedule WHERE date = $1 AND time = $2 AND is_reserved = false", [date, time]);
        if (available.length === 0) return { error: "Slot not available" };

        await query("UPDATE schedule SET is_reserved = true WHERE id = $1", [available[0].id]);
        return await query(
            "INSERT INTO appointments (customer_id, service_id, date, time) VALUES ($1, $2, $3, $4) RETURNING *",
            [customer_id, service_id, date, time]
        );
    },

    // Get all appointments
    getAppointments: async () => {
        return await query("SELECT * FROM appointments");
    },

    // Edit an existing appointment
    editAppointment: async (appointment_id, new_date, new_time) => {
        const appointment = await query("SELECT * FROM appointments WHERE id = $1", [appointment_id]);
        if (appointment.length === 0) return { error: "Appointment not found" };

        const available = await query("SELECT * FROM schedule WHERE date = $1 AND time = $2 AND is_reserved = false", [new_date, new_time]);
        if (available.length === 0) return { error: "New slot is not available" };

        await query("UPDATE schedule SET is_reserved = false WHERE date = $1 AND time = $2", [appointment[0].date, appointment[0].time]);
        await query("UPDATE schedule SET is_reserved = true WHERE date = $1 AND time = $2", [new_date, new_time]);
        return await query("UPDATE appointments SET date = $1, time = $2 WHERE id = $3 RETURNING *", [new_date, new_time, appointment_id]);
    },

    // Cancel an appointment
    cancelAppointment: async (appointment_id) => {
        const appointment = await query("SELECT * FROM appointments WHERE id = $1", [appointment_id]);
        if (appointment.length === 0) return { error: "Appointment not found" };

        await query("UPDATE schedule SET is_reserved = false WHERE date = $1 AND time = $2", [appointment[0].date, appointment[0].time]);
        return await query("DELETE FROM appointments WHERE id = $1 RETURNING *", [appointment_id]);
    }
};
