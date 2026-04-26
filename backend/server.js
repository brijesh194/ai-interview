const express = require('express');
const multer = require('multer');
const fs = require('fs');
const pdf = require('pdf-parse');
const cors = require('cors');
require('dotenv').config();

const { generateQuestions } = require('./utils/geminiConfig');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// --- 1. Start Interview Route ---
app.post('/api/start-interview', upload.single('resume'), async (req, res) => {
    try {
        const { jobDescription, difficulty, language } = req.body; 
        
        if (!req.file || !jobDescription) {
            return res.status(400).json({ error: "Bhai, file aur JD dono zaroori hain!" });
        }

        const resumePath = req.file.path;
        const dataBuffer = fs.readFileSync(resumePath);
        const pdfData = await pdf(dataBuffer);
        const resumeText = pdfData.text;

        const langInstruction = language === 'hi-IN' || language === 'Hinglish' 
            ? "STRICTLY ask all questions in Hinglish (a mix of Hindi and English words). Do not use pure English."
            : "Ask all questions in professional English.";

        const customPrompt = `
            Context: Initial Interview Generation.
            Level: ${difficulty || 'Junior'}
            Language Instruction: ${langInstruction}
            Resume: ${resumeText}
            JD: ${jobDescription}
            
            Task: Generate 5 technical questions. 
            Crucial: Questions must be in the specified Language Instruction.
        `;

        console.log(`Generating ${difficulty} Questions... 🧠`);
        const interviewData = await generateQuestions(customPrompt, jobDescription, "START");

        if (fs.existsSync(resumePath)) fs.unlinkSync(resumePath);
        res.status(200).json({ success: true, questions: interviewData.questions || [] });

    } catch (error) {
        console.error("START ERROR:", error.message);
        res.status(500).json({ error: "Failed to start interview" });
    }
});

// --- 2. Next Question Route (FIXED FOR CODING EDITOR) ---
app.post('/api/next-question', async (req, res) => {
    try {
        const { currentQuestion, userAnswer, history, jd, difficulty, language, timeTaken } = req.body;

        const langInstruction = language === 'hi-IN' || language === 'Hinglish' 
            ? "Ask the next question in Hinglish (Hindi + English mix)."
            : "Ask the next question in professional English.";

        const dynamicPrompt = `
            Interviewer Mode. Level: ${difficulty}. 
            Language Instruction: ${langInstruction}
            Role: ${jd}
            User Answer: ${userAnswer}
            Time Taken: ${timeTaken}s.

            TASK:
            1. Evaluate the user's answer.
            2. Ask the next logical technical question.
            3. CRITICAL: Set "isCodingRound" to true ONLY if the next question requires the user to write code, logic, or a function. For theory/verbal questions, set it to false.
            
            Return ONLY JSON: {"nextQuestion": "string", "isCodingRound": boolean}
        `;

        const response = await generateQuestions(dynamicPrompt, null, "DYNAMIC_MODE");
        res.status(200).json(response);
    } catch (error) {
        res.status(200).json({ nextQuestion: "Agla sawal: Aapne technical challenges kaise handle kiye?", isCodingRound: false });
    }
});

// --- 3. Interview Analysis Route (FIXED FOR ACCURATE RIGHT ANSWERS) ---
app.post('/api/analyze-interview', async (req, res) => {
    try {
        const { history, jd, difficulty, emotionSummary } = req.body;

        const analysisPrompt = `
            You are a Senior Technical Recruiter. 
            Analyze this ${difficulty} level interview for the role: ${jd}.
            
            Interview Data: ${JSON.stringify(history)}
            Emotions Summary: ${JSON.stringify(emotionSummary)}

            STRICT INSTRUCTIONS FOR DETAILED HISTORY:
            1. Evaluate each answer in the history.
            2. "isCorrect" should be true if the answer is 70% technically accurate.
            3. "correctAnswer" MUST be a highly professional, technically detailed, and accurate model answer for THAT SPECIFIC question. 
            4. If the user said "don't know" or gave a wrong answer, the "correctAnswer" should act as a learning resource.

            Return ONLY valid JSON (No markdown):
            {
                "overallScore": "X/10",
                "technicalSkills": "string feedback",
                "communication": "string feedback",
                "timeManagement": "string feedback",
                "strengths": ["point1", "point2"],
                "improvements": ["point1", "point2"],
                "finalVerdict": "Selected/Rejected",
                "detailedHistory": [
                    {
                        "q": "exact question text",
                        "a": "exact user answer",
                        "isCorrect": boolean,
                        "correctAnswer": "The perfect technical answer for this specific question"
                    }
                ]
            }
        `;

        const analysis = await generateQuestions(analysisPrompt, null, "ANALYSIS_MODE"); 
        
        const finalData = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
        res.status(200).json(finalData);

    } catch (error) {
        console.error("ANALYSIS ERROR:", error.message);
        res.status(500).json({ error: "Failed to analyze", details: error.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server is flying on port ${PORT}`));