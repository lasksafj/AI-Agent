const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();
const db = require('./database');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Initialize OpenAI API client using your provided instantiation
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// In-memory conversation context for a single session
// (In production, manage per user/session)
let conversationHistory = [
    {
        role: "system",
        content: `You are an AI receptionist that handles customer inquiries about reservations.
For every incoming customer message, analyze the message and respond in JSON format with three keys:
  - "intent": set to "reservation_inquiry" if the customer is asking about available slots,
              "booking" if the customer wants to book a slot,
              or "general" for all other queries.
  - "timeSlot": if a valid time in HH:MM format is mentioned, provide it as a string; otherwise, use null.
  - "reply": provide a conversational reply for the customer.
Return only a valid JSON object without any additional text.`
    }
];

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

    // Append the new user message to the conversation history
    conversationHistory.push({ role: 'user', content: message });

    try {
        // Call the API with the conversation history, which includes the system prompt (only sent once)
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: conversationHistory,
        });

        // Retrieve the assistant's JSON response
        const assistantResponse = response.choices[0].message.content;

        // Parse the JSON response
        const result = JSON.parse(assistantResponse);
        let { intent, timeSlot, reply } = result;

        // Override or supplement the reply based on external logic if needed
        if (intent === 'reservation_inquiry') {
            const availableSlots = await db.getAvailableSlots();
            if (availableSlots.length > 0) {
                reply = `I found available slots at: ${availableSlots.join(', ')}. Which time would you prefer?`;
            } else {
                reply = 'Sorry, there are no available slots at the moment.';
            }
        } else if (intent === 'booking') {
            if (timeSlot) {
                const success = await db.bookSlot(timeSlot);
                reply = success
                    ? `Your reservation for ${timeSlot} has been confirmed.`
                    : `Sorry, the ${timeSlot} slot is no longer available.`;
            } else {
                reply = 'Could you please specify the time slot you would like to book?';
            }
        }

        // Append the assistant's (final) reply to the conversation history
        conversationHistory.push({ role: 'assistant', content: reply });

        res.json({ reply });
    } catch (error) {
        console.error('OpenAI API error:', error);
        res.json({ reply: 'I am having trouble processing your request right now.' });
    }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
