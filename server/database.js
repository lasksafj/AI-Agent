// Simulated database for available reservation slots
let availableSlots = ['10:00', '11:00', '14:00'];

module.exports = {
    getAvailableSlots: async () => {
        // Return available slots
        return availableSlots;
    },
    bookSlot: async (slot) => {
        // Check if the slot is available and then remove it
        const index = availableSlots.indexOf(slot);
        if (index !== -1) {
            availableSlots.splice(index, 1);
            return true;
        }
        return false;
    },
};
