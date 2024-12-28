const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/generate-cover-letter', async (req, res) => {
    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: "claude-3-sonnet-20240229",
            max_tokens: 1024,
            messages: [{
                role: "user",
                content: req.body.prompt
            }]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));