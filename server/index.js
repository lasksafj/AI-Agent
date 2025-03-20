const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();
const db = require('./database');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Initialize OpenAI API client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// In-memory conversation context for a single session
let conversationHistory = [
    {
        role: "system",
        content: `Your name is Jane. You are a highly skilled AI receptionist for a luxury nail salon named NextNail at Long Beach. Your primary responsibilities include engaging in friendly and informative conversations with customers, assisting them with inquiries about services, and efficiently managing appointments.
Answer always a JSON structure without any addition text based on { intent, timeSlot, reply, name, phone, email }, reply is your answer to customer, 
intent will be: general, reservation_inquiry, book_appointment, edit_appointment, cancel_appointment, service_inquiry. 
if make sure user want to book intent will be 'book_appointment,
elif change appointment, intent will be 'edit_appointment'
elif cancel appointment, intent will be 'cancel_appointment'
elif asking about service, intent will be 'service_inquiry'
elif asking booking, intent will be 'reservation_inquiry'
else not sure what kind if intent, intent will be 'general'
Appointment Rules:
- Customers must book at least 24 hours in advance.
- Rescheduling is allowed up to 12 hours before the appointment.

For appointment management, you can:
- Schedule New Appointments: Check available time slots in the database and suggest options. When a customer wants to book, always ask for their **full name, phone number, and email** before confirming the appointment.
- Modify Existing Appointments: Allow customers to reschedule or cancel based on availability. When a customer wants to modify an appointment, ask for their **phone number** to locate their existing booking.
- Confirm and Save Appointments: Ensure accurate booking by updating the database and providing confirmation.

When a customer inquires about services, retrieve the available services from the database and respond with service details, including the name, description, price, and duration.

Maintain a warm, helpful, and professional tone. Ensure conversations are clear, concise, and free from unnecessary complexity. Always end interactions with a confirmation of the booking or a polite farewell.

`
    }
];

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

    // Append user message to conversation history
    conversationHistory.push({ role: 'user', content: message });

    try {
        // Call OpenAI API with conversation history
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: conversationHistory,
        });

        let assistantResponse = response.choices[0].message.content;
        let result;
        let reply = '';  // <--- define a fallback here

        try {
            // Attempt to parse JSON
            result = JSON.parse(assistantResponse);
            console.log(result);

            let { intent, timeSlot, name, phone, email } = result;

            // If 'reply' is part of the JSON, set it, otherwise keep the fallback
            reply = result.reply || '';

            console.log("1111111111");

            // Handle each intent
            if (intent === 'reservation_inquiry') {
                const availableSlots = await db.getAvailableSlots();
                reply = availableSlots.length > 0
                    ? `I found available slots at: ${availableSlots.map(slot => `${slot.date} at ${slot.time}`).join(', ')}. Which time would you prefer?`
                    : 'Sorry, there are no available slots at the moment.';
            } else if (intent === 'book_appointment') {
                if (timeSlot && name && phone && email) {
                    let customer = await db.query("SELECT * FROM customers WHERE phone = $1", [phone]);
                    if (customer.length === 0) {
                        customer = await db.createCustomer(name, phone, email);
                    }
                    const success = await db.createAppointment(
                        customer[0].id,
                        1,
                        timeSlot.split(' ')[0],
                        timeSlot.split(' ')[1]
                    );
                    reply = success
                        ? `Your reservation for ${timeSlot} has been confirmed.`
                        : `Sorry, the ${timeSlot} slot is no longer available.`;
                } else {
                    reply = 'Could you please provide your full name, phone number, and email to complete the booking?';
                }
            } else if (intent === 'edit_appointment') {
                if (phone && timeSlot) {
                    const appointment = await db.query(
                        "SELECT * FROM appointments WHERE customer_id = (SELECT id FROM customers WHERE phone = $1) LIMIT 1",
                        [phone]
                    );
                    if (appointment.length > 0) {
                        const success = await db.editAppointment(
                            appointment[0].id,
                            timeSlot.split(' ')[0],
                            timeSlot.split(' ')[1]
                        );
                        reply = success
                            ? `Your appointment has been successfully rescheduled to ${timeSlot}.`
                            : `Sorry, I couldn't update your appointment.`;
                    } else {
                        reply = 'I could not find an appointment associated with your phone number. Please provide the correct phone number.';
                    }
                } else {
                    reply = 'Could you please provide your phone number and the new time slot you want?';
                }
            } else if (intent === 'cancel_appointment') {
                if (phone) {
                    const appointment = await db.query(
                        "SELECT * FROM appointments WHERE customer_id = (SELECT id FROM customers WHERE phone = $1) LIMIT 1",
                        [phone]
                    );
                    if (appointment.length > 0) {
                        const success = await db.cancelAppointment(appointment[0].id);
                        reply = success
                            ? `Your appointment has been successfully canceled.`
                            : `Sorry, I couldn't cancel your appointment.`;
                    } else {
                        reply = 'I could not find an appointment associated with your phone number. Please provide the correct phone number.';
                    }
                } else {
                    reply = 'Could you please provide your phone number to locate your appointment?';
                }
            } else if (intent === 'service_inquiry') {
                const services = await db.getServices();
                reply = services.length > 0
                    ? `Here are our available services: ${services.map(service => `${service.name} - ${service.description}, Price: $${service.price}, Duration: ${service.duration}`).join('; ')}`
                    : 'Currently, we do not have any services listed.';
            }
            console.log("2222222222222");

        } catch (error) {
            // If JSON parsing fails, log the error and set a fallback reply
            console.error("JSON Parse Error: OpenAI Response is not valid JSON:", assistantResponse);
            reply = 'I am having trouble understanding your request. Please try again.';
        }

        // Append assistant reply to conversation history
        conversationHistory.push({ role: 'assistant', content: reply });

        // Return the reply in JSON
        res.json({ reply });
    } catch (error) {
        console.error('OpenAI API error:', error);
        res.json({ reply: 'I am having trouble processing your request right now.' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
