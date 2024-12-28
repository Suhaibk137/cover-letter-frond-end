let formData = {};
let currentStep = 0;

const chatFlow = [
   { type: 'bot', text: "Hi! I'll help you create a perfect cover letter. What's your name?" },
   { type: 'input', placeholder: 'Enter your full name', field: 'name' },
   { type: 'bot', text: "Great! What's your email address?" },
   { type: 'input', placeholder: 'Enter your email', field: 'email', inputType: 'email' },
   { type: 'bot', text: 'Which job role are you targeting?' },
   { type: 'input', placeholder: 'e.g., Senior Software Engineer', field: 'role' },
   { type: 'bot', text: 'Please upload your resume (PDF or Word)' },
   { type: 'file', accept: '.pdf,.doc,.docx', field: 'resume' },
   { type: 'bot', text: 'Would you like to upload the job description? (Optional)' },
   { type: 'file', accept: '.pdf,.doc,.docx,.txt', field: 'jobDescription', optional: true }
];

async function extractTextFromFile(file) {
   if (!file) return '';
   const reader = new FileReader();
   
   if (file.type === 'application/pdf') {
       return new Promise((resolve) => {
           reader.onload = async function(event) {
               const typedarray = new Uint8Array(event.target.result);
               const pdf = await pdfjsLib.getDocument(typedarray).promise;
               let fullText = '';
               for (let i = 1; i <= pdf.numPages; i++) {
                   const page = await pdf.getPage(i);
                   const textContent = await page.getTextContent();
                   fullText += textContent.items.map(item => item.str).join(' ') + '\n';
               }
               resolve(fullText);
           };
           reader.readAsArrayBuffer(file);
       });
   } else if (file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
       return new Promise((resolve) => {
           reader.onload = async function(event) {
               const arrayBuffer = event.target.result;
               const result = await mammoth.extractRawText({ arrayBuffer });
               resolve(result.value);
           };
           reader.readAsArrayBuffer(file);
       });
   } else {
       return new Promise((resolve) => {
           reader.onload = function(event) {
               resolve(event.target.result);
           };
           reader.readAsText(file);
       });
   }
}

function startChat() {
   document.getElementById('startScreen').style.display = 'none';
   document.getElementById('chatContainer').style.display = 'block';
   showNextMessage();
}

function createMessage(text, isBot = true) {
   const messageDiv = document.createElement('div');
   messageDiv.className = `message ${isBot ? 'bot-message' : 'user-message'}`;
   messageDiv.textContent = text;
   return messageDiv;
}

function createTypingIndicator() {
   const indicator = document.createElement('div');
   indicator.className = 'typing-indicator';
   indicator.innerHTML = '<span></span><span></span><span></span>';
   return indicator;
}

function createInput(step) {
   const container = document.createElement('div');
   container.className = 'input-container';

   const input = document.createElement('input');
   input.className = 'input-field';
   input.placeholder = step.placeholder;
   input.type = step.inputType || (step.type === 'file' ? 'file' : 'text');
   if (step.accept) input.accept = step.accept;

   const button = document.createElement('button');
   button.className = 'send-btn';
   button.textContent = 'Send';
   button.onclick = () => handleInput(input, step);

   container.appendChild(input);
   container.appendChild(button);
   return container;
}

async function showNextMessage() {
   if (currentStep >= chatFlow.length) {
       handleSubmission();
       return;
   }

   const step = chatFlow[currentStep];
   const messages = document.getElementById('chatMessages');

   if (step.type === 'bot') {
       const typingIndicator = createTypingIndicator();
       messages.appendChild(typingIndicator);
       messages.scrollTop = messages.scrollHeight;

       await new Promise(resolve => setTimeout(resolve, 1500));
       typingIndicator.remove();

       const message = createMessage(step.text);
       messages.appendChild(message);
       messages.scrollTop = messages.scrollHeight;

       currentStep++;
       if (chatFlow[currentStep].type !== 'bot') {
           const inputContainer = createInput(chatFlow[currentStep]);
           messages.appendChild(inputContainer);
       } else {
           showNextMessage();
       }
   }
}

async function handleInput(input, step) {
   const messages = document.getElementById('chatMessages');
   let value;
   
   if (step.type === 'file') {
       const file = input.files[0];
       if (file) {
           const text = await extractTextFromFile(file);
           value = {
               fileName: file.name,
               fileType: file.type,
               content: text
           };
       }
   } else {
       value = input.value;
   }

   if (!value && !step.optional) {
       alert('Please fill in the required field');
       return;
   }

   formData[step.field] = value;
   console.log('Updated formData:', formData);
   
   const displayText = step.type === 'file' ? 
       (value ? value.fileName : 'No file selected') : 
       value;
   
   const message = createMessage(displayText, false);
   messages.appendChild(message);

   input.parentElement.remove();
   currentStep++;
   showNextMessage();
   
   localStorage.setItem('chatFormData', JSON.stringify(formData));
}

async function sendToClaude() {
   const currentDate = new Date().toLocaleDateString('en-US', { 
       month: 'long', 
       day: 'numeric', 
       year: 'numeric' 
   });

   const response = await fetch('https://backend-of-cover-letter.vercel.app/api/generate-cover-letter', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
           prompt: `Create a cover letter in this EXACT format:

${currentDate}

COVER LETTER

Dear Hiring Manager,

[Generate three clear, impactful paragraphs:
1. Introduction mentioning the specific role and company, showing enthusiasm
2. Core qualifications and achievements that match the job requirements
3. Closing with a call to action requesting an interview]

Best regards,
${formData.name}
${formData.email}

Using:
Role: ${formData.role}
Resume Details: ${formData.resume.content}
Job Requirements: ${formData.jobDescription?.content || 'Not provided'}

Format Guidelines:
- Professional business letter format
- Maximum 400 words
- Convert bullet points to flowing paragraphs
- Highlight 2-3 most relevant achievements
- Use active voice and confident tone`
       })
   });

   if (!response.ok) {
       throw new Error(`API Error: ${response.status}`);
   }

   const data = await response.json();
   return data.content[0].text;
}

async function handleSubmission() {
   const messages = document.getElementById('chatMessages');
   const loadingMsg = createMessage("Generating cover letter...");
   messages.appendChild(loadingMsg);
   
   try {
       const coverLetter = await sendToClaude();
       
       const coverLetterDiv = document.createElement('div');
       coverLetterDiv.className = 'cover-letter-container';
       coverLetterDiv.innerHTML = `
           <div class="cover-letter-content">${coverLetter.replace(/\n/g, '<br>')}</div>
           <div class="button-container">
               <button onclick="downloadPDF('${encodeURIComponent(coverLetter)}')" class="download-btn">
                   Download as PDF
               </button>
           </div>
       `;
       
       messages.appendChild(coverLetterDiv);
       loadingMsg.remove();
   } catch (error) {
       console.error('API Error:', error);
       loadingMsg.remove();
       messages.appendChild(createMessage("Error generating cover letter"));
   }
}

function downloadPDF(content) {
   const decodedContent = decodeURIComponent(content);
   const doc = new jspdf.jsPDF();
   
   doc.setFont('times');
   doc.setFontSize(12);
   
   const splitText = doc.splitTextToSize(decodedContent, 180);
   doc.text(splitText, 15, 15);
   doc.save('cover_letter.pdf');
}
// Error handling functions
function handleError(error, message = "An error occurred") {
    console.error(error);
    return message;
 }
 
 // Utility functions
 function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
 }
 
 function validateFileSize(file, maxSize = 5242880) {
    return file.size <= maxSize;
 }
 
 // PDF formatting utilities
 function formatPDFContent(content) {
    const margins = {
        top: 25,
        bottom: 25,
        left: 25,
        right: 25
    };
    
    return {
        content,
        margins
    };
 }
 
 // Reset function
 function resetForm() {
    formData = {};
    currentStep = 0;
    const messages = document.getElementById('chatMessages');
    messages.innerHTML = '';
    localStorage.removeItem('chatFormData');
    document.getElementById('startScreen').style.display = 'block';
    document.getElementById('chatContainer').style.display = 'none';
 }
 
 // Browser compatibility check
 function checkCompatibility() {
    const features = [
        window.File,
        window.FileReader,
        window.FileList,
        window.Blob,
        window.fetch
    ];
    
    return features.every(Boolean);
 }
 
 // Initialize
 window.addEventListener('load', () => {
    if (!checkCompatibility()) {
        alert('Your browser may not support all features. Please use a modern browser.');
    }
    
    // Restore data if exists
    const savedData = localStorage.getItem('chatFormData');
    if (savedData) {
        formData = JSON.parse(savedData);
    }
 });
 
 // Error handler for file operations
 window.addEventListener('error', function(e) {
    console.error('File operation error:', e);
    return false;
 });
