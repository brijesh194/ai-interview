const Groq = require("groq-sdk");
require("dotenv").config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const generateQuestions = async (inputA, inputB, mode = "START") => {
  try {
    console.log(`Calling Groq AI (${mode})... ⚡`);
    
    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "DYNAMIC_MODE") {
      systemPrompt = "You are a senior technical interviewer. Analyze the user's last answer and ask the next logical question. Return strictly JSON with 'nextQuestion' and 'isCodingRound' keys.";
      userPrompt = inputA; 
    } 
    else if (mode === "ANALYSIS_MODE") {
      // 🔥 Added specific handling for Final Report
      systemPrompt = "You are a Senior Recruiter. Provide a professional interview performance analysis in JSON format only.";
      userPrompt = inputA;
    }
    else {
      // Default Mode: Initial 5 questions
      systemPrompt = "You are a professional technical interviewer. Return strictly as JSON object.";
      userPrompt = `Analyze this Resume: ${inputA} and Job Description: ${inputB}. 
          Generate 5 specific technical interview questions based on the candidate's skills.
          Format: {"questions": ["q1", "q2", "q3", "q4", "q5"]}`;
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });

    const content = chatCompletion.choices[0].message.content;
    return JSON.parse(content);

  } catch (error) {
    console.error("Groq AI Error:", error.message);
    
    // Fallback logic
    if (mode === "DYNAMIC_MODE") {
        return { nextQuestion: "Can you explain your approach in more detail?", isCodingRound: false };
    }
    if (mode === "ANALYSIS_MODE") {
        return {
            overallScore: "N/A",
            technicalSkills: "Analysis failed due to a server glitch.",
            communication: "N/A",
            strengths: ["Try again"],
            improvements: ["Check server logs"],
            finalVerdict: "Retry Needed"
        };
    }
    return { 
        questions: ["Describe your most challenging project.", "What is your debugging process?"] 
    };
  }
};

module.exports = { generateQuestions };