// Test script for story extraction functionality
const { generateFullLifeStory } = require('./services/aiService');

// Sample AI response with Hebrew content
const sampleResponse = {
  choices: [{
    message: {
      content: `# סיפור החיים של דוד כהן

## ילדות בירושלים
דוד נולד בירושלים בשנת 1950 למשפחה דתית. הוא גדל בשכונת מאה שערים, שם למד בחדר ובישיבה. ילדותו הייתה מלאה בלימוד תורה ומסורת.

## שירות צבאי ולימודים
בגיל 18 התגייס דוד לצה"ל ושירת בחיל המודיעין. לאחר שחרורו, פנה ללימודי הנדסת חשמל בטכניון בחיפה. תקופת הלימודים הייתה מאתגרת אך מספקת.

## קריירה וחיי משפחה
אחרי סיום התואר, דוד החל לעבוד בחברת היי-טק בתל אביב. הוא פגש את אשתו רחל בכנס טכנולוגי, והם הקימו משפחה עם שלושה ילדים. הקריירה שלו התפתחה והוא הפך למנהל בכיר.

## עלייה להונגריה ושיבה לישראל
בשנת 1995, דוד קיבל הצעת עבודה בבודפשט והמשפחה עברה להונגריה לחמש שנים. החוויה הבינלאומית העשירה את חייהם, אך הם החליטו לחזור לישראל ב-2000.

## פרישה ופעילות קהילתית
לאחר פרישתו בגיל 67, דוד החל להתנדב כמדריך נוער בקהילה המקומית. הוא מעביר את חוכמת החיים שלו לדור הצעיר ונהנה מזמן איכות עם נכדיו.`
    }
  }]
};

// Test the extraction function
async function testStoryExtraction() {
  console.log('Testing story extraction with Hebrew content...');
  
  try {
    const result = await generateFullLifeStory({
      sessionId: 'test-session',
      aiResponse: sampleResponse
    });
    
    console.log('Extraction Results:');
    console.log('Title:', result.title);
    console.log('Chapters:', JSON.stringify(result.chapters, null, 2));
    console.log('Themes:', result.themes);
    console.log('Word Count:', result.wordCount);
    
    // Validate results
    console.log('\nValidation:');
    console.log('Title extracted correctly:', !!result.title);
    console.log('Number of chapters extracted:', result.chapters.length);
    console.log('Number of themes detected:', result.themes.length);
    console.log('Hebrew themes detected:', result.themes.filter(t => /[\u0590-\u05FF]/.test(t)));
    
  } catch (error) {
    console.error('Error during extraction test:', error);
  }
}

// Run the test
testStoryExtraction();
