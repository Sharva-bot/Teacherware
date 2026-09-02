import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables if present
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Shared server-side Gemini client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // API Endpoints
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', databaseConnected: true });
  });

  // POST /api/seating
  app.post('/api/seating', async (req, res) => {
    try {
      const { students, classroomLayout, strategy, customRules } = req.body;
      if (!Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ error: 'At least one student is required for seating arrangement.' });
      }

      // If Gemini API Key is missing, respond gracefully
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: 'Gemini API Key is not configured in Settings > Secrets. Please add GEMINI_API_KEY to continue.',
        });
      }

      // Format student information cleanly for the model
      const studentsPrompt = students
        .map((s, idx) => {
          return `${idx + 1}. Name: ${s.name}, ID: ${s.id}, Gender: ${s.gender}, Tags: [${s.tags.join(', ')}], Notes: "${s.notes || 'None'}"`;
        })
        .join('\n');

      let classroomLayoutContext = 'No custom physical layout provided. Assume default front whiteboard arrangement.';
      let benchesList = '';
      const activeBenches = classroomLayout?.benches || [
        { id: 'bench-1', name: 'Bench 1', x: 20, y: 30 },
        { id: 'bench-2', name: 'Bench 2', x: 20, y: 70 },
        { id: 'bench-3', name: 'Bench 3', x: 50, y: 30 },
        { id: 'bench-4', name: 'Bench 4', x: 50, y: 70 },
        { id: 'bench-5', name: 'Bench 5', x: 80, y: 30 },
        { id: 'bench-6', name: 'Bench 6', x: 80, y: 70 },
      ];

      benchesList = activeBenches
        .map((b: any) => `- Bench ID: "${b.id}", Name: "${b.name}" (Physical Location: X-coordinate = ${b.x}% from Left wall, Y-coordinate = ${b.y}% from Front wall)`)
        .join('\n');

      if (classroomLayout) {
        classroomLayoutContext = `
- Smart Board Location: ${classroomLayout.smartBoardLocation} Wall
- Entrance Doorway Location: ${classroomLayout.doorLocation}
- Teacher's Desk Location: ${classroomLayout.teacherDeskLocation}
- Wall Window Locations: ${Array.isArray(classroomLayout.windowLocations) && classroomLayout.windowLocations.length > 0 ? classroomLayout.windowLocations.join(', ') : 'None'}
- Custom Behavioral Layout Directives: "${classroomLayout.customNotes || 'None'}"
`;
      }

      // Format custom rules if provided
      let rulesContext = 'No strict custom teacher rules defined.';
      if (Array.isArray(customRules) && customRules.length > 0) {
        const rulesList = customRules.map((r: any, i: number) => {
          const s1 = students.find((s: any) => s.id === r.student1Id)?.name || r.student1Id;
          const s2 = students.find((s: any) => s.id === r.student2Id)?.name || r.student2Id;
          if (r.type === 'separate') return `${i + 1}. MUST SEPARATE: Keep "${s1}" and "${s2}" on DIFFERENT benches (do not seat together).`;
          if (r.type === 'pair') return `${i + 1}. MUST PAIR: Seat "${s1}" and "${s2}" TOGETHER on the SAME bench.`;
          if (r.type === 'lock') return `${i + 1}. FIXED SEAT: Lock "${s1}" to Bench "${r.benchId}" (${r.seat || 'Left'} seat).`;
          return `${i + 1}. Rule: ${JSON.stringify(r)}`;
        }).join('\n');
        rulesContext = `STRICT TEACHER MANDATES (MUST BE RESPECTED HIGHEST PRIORITY):\n${rulesList}`;
      }

      // Strategy mode context
      const strategyMode = strategy || 'behavioral';
      let strategyContext = '';
      if (strategyMode === 'behavioral') {
        strategyContext = 'OPTIMIZATION GOAL: Behavioral Balance & Focus. Separate talkative students, place easily distracted students away from doors/windows, place vision/hearing needs in front.';
      } else if (strategyMode === 'peer_tutoring') {
        strategyContext = 'OPTIMIZATION GOAL: Peer Tutoring & Academic Support. Pair high-performing or helper students with students who need academic guidance or assistance.';
      } else if (strategyMode === 'exam_anti_cheat') {
        strategyContext = 'OPTIMIZATION GOAL: Exam & Quiz Mode (Anti-Cheating). Maximize physical distance between students. Keep talkative or close friends apart. Fill single seats across benches where possible.';
      } else if (strategyMode === 'gender_balanced') {
        strategyContext = 'OPTIMIZATION GOAL: Gender Balance. Maintain an even mix of Male and Female students across bench pairings.';
      } else if (strategyMode === 'social_mixing') {
        strategyContext = 'OPTIMIZATION GOAL: Social Integration & New Friendships. Mix up existing cliques and pair students who do not usually sit together.';
      }

      const systemInstruction = `You are an elite master classroom seating planner powered by pedagogical AI.
Your task is to calculate an optimized, highly intelligent classroom seating arrangement for the student roster on available benches.

PRIMARY PEDAGOGICAL STRATEGY:
${strategyContext}

TEACHER MANDATES & CUSTOM RULES:
${rulesContext}

PHYSICAL CLASSROOM LAYOUT CONSTRAINTS:
${classroomLayoutContext}

AVAILABLE BENCHES (EACH HOLDS MAX 2 STUDENTS):
${benchesList}

INSTRUCTIONS FOR INTENTIONAL STUDENT PLACEMENT:
- Each bench has exactly two seats: "Left" and "Right".
- Total available capacity is ${activeBenches.length * 2} seats (2 per bench).
- Assign each student to a specific benchId and seat ("Left" or "Right"). Do not double-book any seat.
- If there are fewer students than available capacity, leave excess seats empty (use studentId "Empty" and studentName "Empty").
- Placement Rules based on physics coordinates:
  * SMART BOARD: If the board is on the Front (Y=0), place sight-needs or front-row students on benches with lowest Y-coordinates (closest to front). If on Left (X=0), place them on benches with lowest X-coordinates.
  * DOOR & WINDOWS: Place "Easily Distracted" or anxious students FAR AWAY from the Entrance Doorway and Window locations.
  * TEACHER: Place quiet or needy learners close to the Teacher's Desk coordinates.
  * TALKATIVE: Never place two highly talkative students on the same bench.

ALSO CALCULATE CLASSROOM HARMONY ANALYSIS:
- Calculate an overallScore (0-100) representing how well all constraints and strategies were satisfied.
- Provide a summary sentence of the overall arrangement health.
- Provide benchInsights for each active bench with a compatibility label (e.g. "Peer Helper Pair", "Quiet Focus Zone", "Vision Priority Seat"), type ("optimal", "warning", or "neutral"), and a short description.

Return a structured JSON response matching the requested schema.`;

      const prompt = `Arrange seating for these ${students.length} students under "${strategyMode}" strategy:
${studentsPrompt}`;

      // Models sequence to try in case of 503/high demand/temporary outages
      const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
      let response;
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          console.log(`Attempting seating generation using model: ${modelName}`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: systemInstruction,
              temperature: 0.2,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  assignments: {
                    type: Type.ARRAY,
                    description: 'The assigned seats in the classroom seating layout.',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        benchId: {
                          type: Type.STRING,
                          description: 'The unique ID of the bench.',
                        },
                        seat: {
                          type: Type.STRING,
                          description: '"Left" or "Right" seat on that bench',
                        },
                        studentId: {
                          type: Type.STRING,
                          description: 'The unique ID of the seated student, or "Empty"',
                        },
                        studentName: {
                          type: Type.STRING,
                          description: 'The full name of the student, or "Empty"',
                        },
                      },
                      required: ['benchId', 'seat', 'studentId', 'studentName'],
                    },
                  },
                  reasoning: {
                    type: Type.ARRAY,
                    description: 'Explanations for why specific placement choices were made based on student tags.',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        studentName: { type: Type.STRING },
                        explanation: { type: Type.STRING },
                      },
                      required: ['studentName', 'explanation'],
                    },
                  },
                  harmonyAnalysis: {
                    type: Type.OBJECT,
                    description: 'Classroom harmony and layout health analysis.',
                    properties: {
                      overallScore: { type: Type.NUMBER },
                      summary: { type: Type.STRING },
                      benchInsights: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            benchId: { type: Type.STRING },
                            compatibilityLabel: { type: Type.STRING },
                            type: { type: Type.STRING },
                            description: { type: Type.STRING }
                          },
                          required: ['benchId', 'compatibilityLabel', 'type', 'description']
                        }
                      }
                    },
                    required: ['overallScore', 'summary']
                  }
                },
                required: ['assignments', 'reasoning'],
              },
            },
          });
          
          // If we successfully got a response, break the retry loop
          if (response) {
            console.log(`Seating generation succeeded with model: ${modelName}`);
            break;
          }
        } catch (err: any) {
          console.warn(`Model ${modelName} failed. Error:`, err.message || err);
          lastError = err;
          // Continue to next model in sequence
        }
      }

      if (!response) {
        throw lastError || new Error('All configured Gemini models failed to generate seating.');
      }

      const responseText = response.text || '{}';
      const parsedData = JSON.parse(responseText);
      res.json(parsedData);
    } catch (err: any) {
      console.error('Gemini API seating arrangement error:', err);
      res.status(500).json({ error: err.message || 'Failed to generate seating layout from Gemini.' });
    }
  });

  // POST /api/generate-material
  app.post('/api/generate-material', async (req, res) => {
    try {
      const { images, title } = req.body;
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'At least one textbook picture is required to generate study materials.' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: 'Gemini API Key is not configured in Settings > Secrets. Please add GEMINI_API_KEY to continue.',
        });
      }

      // Convert images array of base64 data URLs to Gemini parts
      const inlineDataParts = images.map((base64DataUrl: string) => {
        const matches = base64DataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-+.]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          return {
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          };
        }
        return {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64DataUrl
          }
        };
      });

      const systemInstruction = `You are an elite educational AI assistant and expert curriculum developer.
Your task is to analyze the textbook pages or pictures provided, and generate a comprehensive Study Guide and a high-quality Test Paper with an Answer Key.

1. STUDY GUIDE:
- Summarize the core themes, chapters, or concepts presented in the images.
- Provide clear definitions of any technical terms, equations, or vocabulary.
- Include structured bullet points, key takeaways, and visual descriptions of any diagrams if relevant.
- Keep the tone encouraging, academic, and extremely clear.

2. TEST PAPER:
- Create a multi-part exam based strictly on the textbook material.
- Part A: Multiple Choice Questions (with options A, B, C, D).
- Part B: Short Answer Questions.
- Part C: Critical Thinking / Conceptual Essay Questions.
- Include a separate, detailed "Answer Key" at the end of the Test Paper so teachers can grade student work.

Formatting: Output the response as a structured JSON object matching the requested schema. Use rich Markdown inside studyGuide and testPaper fields to make it beautiful (headings, tables, lists, bold text, blockquotes).`;

      const prompt = `Analyze these ${images.length} textbook pictures${title ? ` from chapter "${title}"` : ''} and generate a detailed study guide and custom test paper with answer key. Ensure every single key concept in these pictures is explained.`;

      // Models sequence to try in case of temporary demand / availability
      const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
      let response;
      let lastError: any = null;

      const contents = [
        ...inlineDataParts,
        prompt
      ];

      for (const modelName of modelsToTry) {
        try {
          console.log(`Attempting material generation using model: ${modelName}`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: contents,
            config: {
              systemInstruction: systemInstruction,
              temperature: 0.3,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  studyGuide: {
                    type: Type.STRING,
                    description: 'Detailed study guide summarizing concepts in clean, rich Markdown.'
                  },
                  testPaper: {
                    type: Type.STRING,
                    description: 'Comprehensive test paper with questions and Answer Key in clean, rich Markdown.'
                  }
                },
                required: ['studyGuide', 'testPaper']
              }
            }
          });

          if (response) {
            console.log(`Material generation succeeded with model: ${modelName}`);
            break;
          }
        } catch (err: any) {
          console.warn(`Model ${modelName} failed for material generation. Error:`, err.message || err);
          lastError = err;
        }
      }

      if (!response) {
        throw lastError || new Error('All configured Gemini models failed to analyze textbook pictures.');
      }

      const responseText = response.text || '{}';
      const parsedData = JSON.parse(responseText);
      res.json(parsedData);
    } catch (err: any) {
      console.error('Gemini material generation error:', err);
      res.status(500).json({ error: err.message || 'Failed to analyze textbook pictures and generate study guides.' });
    }
  });

  // POST /api/organize-materials - Categorizes existing items into logical folders
  app.post('/api/organize-materials', async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required for organization.' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: 'Gemini API Key is not configured in Settings. Please add GEMINI_API_KEY.',
        });
      }

      const systemInstruction = `You are a smart cataloging AI assistant designed to group academic documents and class notes into highly logical, concise folders (such as "Biology", "Algebra", "World War II", "General Science", "Syllabus").
Read the list of items provided (containing IDs, titles, and brief summaries) and determine the single most appropriate folder name for each item. Keep folder names concise (1-3 words max).
Output the suggestions as a structured array containing objects with itemId and suggestedFolder.`;

      const prompt = `Categorize these materials into folders: ${JSON.stringify(items)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [prompt],
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              classifications: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemId: { type: Type.STRING },
                    suggestedFolder: { type: Type.STRING }
                  },
                  required: ['itemId', 'suggestedFolder']
                }
              }
            },
            required: ['classifications']
          }
        }
      });

      const responseText = response.text || '{"classifications": []}';
      res.json(JSON.parse(responseText));
    } catch (err: any) {
      console.error('AI organization error:', err);
      res.status(500).json({ error: err.message || 'Failed to run AI material classification.' });
    }
  });

  // POST /api/grade-test-paper - Analyzes a single test paper image, extracts student name, cross-checks roster, grades answers, and returns score breakdown
  app.post('/api/grade-test-paper', async (req, res) => {
    try {
      const { image, students, examTitle, maxScore, answerKey } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'Test paper image data is required.' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: 'Gemini API Key is not configured in Settings. Please add GEMINI_API_KEY to continue.',
        });
      }

      // Format student roster for Gemini matching context
      const rosterContext = Array.isArray(students) && students.length > 0
        ? students.map((s: any) => `- Student ID: "${s.id}", Name: "${s.name}", Roll No: "${s.rollNumber || 'N/A'}", Grade/Class: "${s.grade || 'N/A'}"`).join('\n')
        : 'No student roster provided. Detect the name on paper directly.';

      // Extract base64 image data
      let mimeType = 'image/jpeg';
      let base64Data = image;
      const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-+.]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      }

      const inlineDataPart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      };

      const numericMaxScore = Number(maxScore) || 100;

      const systemInstruction = `You are an elite school teacher assistant, AI paper auditor, and test evaluation verification specialist.

CRITICAL SAFETY GUARDRAIL & DOUBLE-CHECKING DIRECTIVE:
You operate strictly as a SECONDARY AUDITOR to VERIFY AND DOUBLE-CHECK test papers that HAVE ALREADY BEEN CORRECTED BY A HUMAN TEACHER.
You MUST FIRST examine the test paper image to check if a human teacher has already corrected/graded the paper (looking for red/ink ticks ✔, crosses ✘, circled marks, handwritten numerical scores, or teacher correction notes).

1. TEACHER CORRECTION DETECTION & MANDATORY GUARDRAIL:
- Carefully inspect the document image for visual evidence of human teacher corrections (handwritten ink/red ticks, crosses, handwritten scores, circles, or feedback).
- Set "teacherCorrectionDetected" and "isTeacherCorrected" to true ONLY IF teacher markings/corrections are clearly present.
- IF NO TEACHER CORRECTIONS ARE DETECTED (the test paper is clean/uncorrected/fresh student work with no human teacher markings):
  * YOU MUST TRIGGER THE MANDATORY SAFETY GUARDRAIL AND REFUSE TO ORIGINALLY GRADE IT.
  * Set "teacherCorrectionDetected" to false.
  * Set "isTeacherCorrected" to false.
  * Set "status" to "uncorrected_guardrail_blocked".
  * Set "guardrailMessage" to "SAFETY GUARDRAIL BLOCKED: This test paper has NOT been corrected by a human teacher yet. The AI Auto-Grader is restricted to double-checking papers that have already been corrected by a human teacher to audit teacher mistakes."
  * Set "score" to 0, "maxScore" to ${numericMaxScore}, "percentage" to 0, "grade" to "N/A", and "overallFeedback" to "SAFETY GUARDRAIL TRIGGERED: This paper lacks human teacher corrections. The AI is forbidden from initial paper grading. Please manually correct and mark the paper first, then upload for AI double-checking."
  * Set "teacherGradingAudit" to { "humanTeacherScore": null, "aiVerifiedScore": 0, "hasTeacherDiscrepancy": true, "teacherMistakesFound": ["Test paper has not been corrected by human teacher."], "auditSummary": "Guardrail Blocked: Paper uncorrected by human teacher." }

2. WHEN TEACHER CORRECTIONS ARE PRESENT ("teacherCorrectionDetected": true):
- Perform full double-check verification & audit of the human teacher's work:
- Extract student name from paper and match against roster:
${rosterContext}
- Read the handwritten total score or section marks written by the human teacher on the paper (e.g., "18/20", "85", etc.) and set "humanTeacherScore".
- Independently evaluate all student answers against standard academic knowledge or provided Answer Key: "${answerKey || 'Grade based on standard subject accuracy'}".
- Calculate the AI verified total score ("aiVerifiedScore") and percentage.
- AUDIT THE HUMAN TEACHER'S CORRECTIONS FOR MISTAKES:
  * Check for math/addition errors in the teacher's score summation.
  * Check for questions the teacher missed or forgot to grade.
  * Check for correct answers the teacher mistakenly marked wrong.
  * Check for incorrect answers the teacher accidentally gave credit for.
- Set "hasTeacherDiscrepancy" to true if the teacher made ANY mistake or math addition error.
- List all specific teacher mistakes in "teacherMistakesFound" array of strings (e.g. "Teacher addition error: Section totals equal 16/20, but teacher wrote 18/20 on cover", "Question 4: Student answer was incorrect but teacher awarded full marks").
- Provide a clear "auditSummary" (e.g. "Teacher grading audited: 1 addition mistake detected by AI double-check" or "Teacher grading 100% verified and accurate").
- Populate "status" as "graded" (or "unmatched" if student name not found on roster).

Output structured JSON matching the requested schema.`;

      const prompt = `Perform AI double-check audit on this test paper for exam "${examTitle || 'Class Test'}" out of max score ${numericMaxScore}. Ensure safety guardrail checks whether human teacher corrected the paper first.`;

      const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
      let response;
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          console.log(`Attempting test paper grading & audit using model: ${modelName}`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: [inlineDataPart, prompt],
            config: {
              systemInstruction: systemInstruction,
              temperature: 0.2,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  detectedName: {
                    type: Type.STRING,
                    description: 'Raw student name read from the top of the test paper image.'
                  },
                  matchedStudentId: {
                    type: Type.STRING,
                    description: 'The unique student ID from the class roster if matched, or null if unmatched.',
                    nullable: true
                  },
                  matchedStudentName: {
                    type: Type.STRING,
                    description: 'Name from roster if matched, or detected name if unmatched.'
                  },
                  status: {
                    type: Type.STRING,
                    description: '"graded" if matched with roster, "unmatched" if name not on roster, or "uncorrected_guardrail_blocked" if teacher marks missing.'
                  },
                  isTeacherCorrected: {
                    type: Type.BOOLEAN,
                    description: 'True if human teacher correction marks (ticks, crosses, scores) were detected on paper.'
                  },
                  teacherCorrectionDetected: {
                    type: Type.BOOLEAN,
                    description: 'True if teacher markings were detected.'
                  },
                  guardrailMessage: {
                    type: Type.STRING,
                    description: 'Safety guardrail message if uncorrected paper is blocked.',
                    nullable: true
                  },
                  score: {
                    type: Type.NUMBER,
                    description: 'AI verified numeric score awarded to the student.'
                  },
                  maxScore: {
                    type: Type.NUMBER,
                    description: 'Maximum achievable score.'
                  },
                  percentage: {
                    type: Type.NUMBER,
                    description: 'Calculated score percentage (0-100).'
                  },
                  grade: {
                    type: Type.STRING,
                    description: 'Letter grade assigned (A+, A, B, C, D, F, or N/A).'
                  },
                  overallFeedback: {
                    type: Type.STRING,
                    description: 'Summary feedback and performance remarks.'
                  },
                  teacherGradingAudit: {
                    type: Type.OBJECT,
                    description: 'Double-check audit of human teacher correction accuracy.',
                    properties: {
                      humanTeacherScore: {
                        type: Type.NUMBER,
                        description: 'The handwritten score written on paper by the human teacher.',
                        nullable: true
                      },
                      aiVerifiedScore: {
                        type: Type.NUMBER,
                        description: 'The AI re-verified correct score.'
                      },
                      hasTeacherDiscrepancy: {
                        type: Type.BOOLEAN,
                        description: 'True if the AI detected any grading mistake or addition error made by the teacher.'
                      },
                      teacherMistakesFound: {
                        type: Type.ARRAY,
                        description: 'List of specific mistakes found in the teacher\'s grading.',
                        items: { type: Type.STRING }
                      },
                      auditSummary: {
                        type: Type.STRING,
                        description: 'Overall double-check audit summary of teacher accuracy.'
                      }
                    },
                    required: ['aiVerifiedScore', 'hasTeacherDiscrepancy', 'teacherMistakesFound', 'auditSummary']
                  },
                  questionBreakdown: {
                    type: Type.ARRAY,
                    description: 'Question by question grading breakdown.',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        questionNumber: { type: Type.STRING },
                        studentAnswer: { type: Type.STRING },
                        correctAnswer: { type: Type.STRING },
                        maxMarks: { type: Type.NUMBER },
                        marksAwarded: { type: Type.NUMBER },
                        isCorrect: { type: Type.BOOLEAN },
                        feedback: { type: Type.STRING }
                      },
                      required: ['questionNumber', 'studentAnswer', 'maxMarks', 'marksAwarded', 'isCorrect']
                    }
                  }
                },
                required: ['detectedName', 'matchedStudentName', 'status', 'isTeacherCorrected', 'teacherCorrectionDetected', 'score', 'maxScore', 'percentage', 'grade', 'overallFeedback', 'questionBreakdown', 'teacherGradingAudit']
              }
            }
          });

          if (response) {
            console.log(`Test paper grading succeeded with model: ${modelName}`);
            break;
          }
        } catch (err: any) {
          console.warn(`Model ${modelName} failed for test paper grading. Error:`, err.message || err);
          lastError = err;
        }
      }

      if (!response) {
        throw lastError || new Error('All configured Gemini models failed to grade the test paper.');
      }

      const responseText = response.text || '{}';
      res.json(JSON.parse(responseText));
    } catch (err: any) {
      console.error('Gemini test paper grading error:', err);
      res.status(500).json({ error: err.message || 'Failed to grade test paper with Gemini AI.' });
    }
  });

  // POST /api/detect-cheating - Compares test answers of seated-together/adjacent students to detect cheating & warn teacher
  app.post('/api/detect-cheating', async (req, res) => {
    try {
      const { examRecord, assignments, benches } = req.body;
      if (!examRecord || !Array.isArray(examRecord.gradedPapers) || examRecord.gradedPapers.length < 2) {
        return res.status(400).json({ error: 'Exam record with at least two graded papers is required to run cheating detection.' });
      }

      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({ error: 'Active seating arrangement is required to cross-reference seated neighbors.' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: 'Gemini API Key is not configured in Settings.',
        });
      }

      // Group students by benchId to find bench-mates and nearby neighbors
      const benchMap = new Map<string, any[]>();
      assignments.forEach((assignment: any) => {
        if (assignment.studentId && assignment.studentId !== 'Empty') {
          const list = benchMap.get(assignment.benchId) || [];
          list.push(assignment);
          benchMap.set(assignment.benchId, list);
        }
      });

      // Find pairs of students seated together on the same bench
      const candidatePairs: { student1: any; student2: any; benchId: string; benchName: string }[] = [];
      benchMap.forEach((seatedList, benchId) => {
        if (seatedList.length >= 2) {
          const bObj = Array.isArray(benches) ? benches.find((b: any) => b.id === benchId) : null;
          const benchName = bObj ? bObj.name : `Bench ${benchId}`;
          candidatePairs.push({
            student1: seatedList[0],
            student2: seatedList[1],
            benchId,
            benchName,
          });
        }
      });

      if (candidatePairs.length === 0) {
        return res.json({ alerts: [], message: 'No student pairs found seated on the same bench.' });
      }

      // Build context of exam paper answers for each candidate pair
      const pairsContextList: any[] = [];
      candidatePairs.forEach((pair, idx) => {
        const paper1 = examRecord.gradedPapers.find((p: any) => p.matchedStudentId === pair.student1.studentId);
        const paper2 = examRecord.gradedPapers.find((p: any) => p.matchedStudentId === pair.student2.studentId);

        if (paper1 && paper2) {
          pairsContextList.push({
            pairIndex: idx + 1,
            benchName: pair.benchName,
            benchId: pair.benchId,
            student1: { id: pair.student1.studentId, name: pair.student1.studentName, score: paper1.score, breakdown: paper1.questionBreakdown || [] },
            student2: { id: pair.student2.studentId, name: pair.student2.studentName, score: paper2.score, breakdown: paper2.questionBreakdown || [] },
          });
        }
      });

      if (pairsContextList.length === 0) {
        return res.json({ alerts: [], message: 'Seated students have not submitted graded papers for this exam yet.' });
      }

      const systemInstruction = `You are a strict academic integrity officer, cheating detection specialist, and classroom analysis AI.
Your task is to analyze the question-by-question test answers of student pairs who were SEATED DIRECTLY TOGETHER ON THE SAME BENCH during an exam.

For each pair, perform a forensic academic comparison:
1. Compare answers across all questions.
2. Identify IDENTICAL INCORRECT ANSWERS (e.g. both students wrote the exact same wrong answer, made the exact same arithmetic error, or used suspicious identical phrasing).
3. Calculate similarity percentage (0 to 100).
4. Determine suspicionLevel: "high" (strong evidence of cheating/copying), "medium" (suspicious identical mistakes), or "low" (coincidence/normal variation).
5. If suspicionLevel is "high" or "medium", flag a Cheating Alert! Include list of identical mistakes and a clear, evidence-based summary warning for the teacher.

Output a structured JSON object containing an array of flagged alerts. If no cheating is detected, return an empty alerts array.`;

      const prompt = `Analyze these ${pairsContextList.length} seated-together student pairs for exam "${examRecord.examTitle}":
${JSON.stringify(pairsContextList, null, 2)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [prompt],
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              alerts: {
                type: Type.ARRAY,
                description: 'Flagged cheating warnings for seated student pairs.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    examId: { type: Type.STRING },
                    examTitle: { type: Type.STRING },
                    student1Id: { type: Type.STRING },
                    student1Name: { type: Type.STRING },
                    student2Id: { type: Type.STRING },
                    student2Name: { type: Type.STRING },
                    benchId: { type: Type.STRING },
                    benchName: { type: Type.STRING },
                    similarityPercentage: { type: Type.NUMBER },
                    suspicionLevel: { type: Type.STRING, description: '"high", "medium", or "low"' },
                    identicalMistakes: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'List of questions with matching wrong answers or identical typos.'
                    },
                    summary: {
                      type: Type.STRING,
                      description: 'Teacher warning summary detailing evidence of cheating.'
                    }
                  },
                  required: ['student1Id', 'student1Name', 'student2Id', 'student2Name', 'benchId', 'benchName', 'similarityPercentage', 'suspicionLevel', 'summary']
                }
              }
            },
            required: ['alerts']
          }
        }
      });

      const responseText = response.text || '{"alerts": []}';
      const parsedData = JSON.parse(responseText);
      const alerts = Array.isArray(parsedData.alerts) ? parsedData.alerts : [];

      // Attach examId and examTitle default if missing
      const formattedAlerts = alerts.map((a: any) => ({
        ...a,
        examId: examRecord.id,
        examTitle: examRecord.examTitle,
        status: 'active_warning',
        detectedAt: new Date().toISOString()
      }));

      res.json({ alerts: formattedAlerts });
    } catch (err: any) {
      console.error('Cheating detection API error:', err);
      res.status(500).json({ error: err.message || 'Failed to execute cheating detection analysis.' });
    }
  });

  // Serve static assets in production or mount Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
