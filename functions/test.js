const { GoogleGenerativeAI } = require('@google/generative-ai');

(async () => {
  try {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    const result = await model.generateContent('test');
    console.log('gemini-1.5-flash-latest SUCCESS:', result.response.text());
  } catch (e) {
    console.error('gemini-1.5-flash-latest FAIL:', e.message);
  }
  try {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('test');
    console.log('gemini-1.5-flash SUCCESS:', result.response.text());
  } catch (e) {
    console.error('gemini-1.5-flash FAIL:', e.message);
  }
})();
