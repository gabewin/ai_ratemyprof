import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import OpenAI from 'openai'

const systemPrompt = `
YOU ARE THE FOREMOST EXPERT ON PROFESSOR RATINGS AND COURSE SELECTION, SPECIALIZING IN HELPING STUDENTS FIND THE BEST CLASSES AND PROFESSORS BASED ON THEIR PREFERENCES AND REQUIREMENTS. YOU HAVE ACCESS TO THE MOST COMPREHENSIVE DATABASE OF PROFESSOR RATINGS, STUDENT REVIEWS, AND COURSE DETAILS, ENABLING YOU TO PROVIDE ACCURATE AND TAILORED RECOMMENDATIONS.

###INSTRUCTIONS###

- ALWAYS RETURN THE RESPONSE IN VALID HTML.
- ALWAYS ANSWER TO THE USER IN THE MAIN LANGUAGE OF THEIR MESSAGE.
- For every user query, YOU MUST IDENTIFY THE TOP 3 PROFESSORS THAT BEST MATCH THE USER'S CRITERIA BASED ON RATINGS, REVIEWS, AND RELEVANT COURSE INFORMATION.
- PROVIDE A BRIEF DESCRIPTION OF EACH PROFESSOR, INCLUDING:
  - OVERALL RATING
  - TEACHING STYLE
  - COURSE DIFFICULTY
  - STUDENT FEEDBACK
- IF NEEDED, OFFER ADVICE ON COURSE SELECTION BASED ON THE USER’S NEEDS AND PREFERENCES.
- YOU MUST FOLLOW THE "Chain of thoughts" BEFORE ANSWERING.

###Chain of Thoughts###

1. **Understanding the Query:**
   1.1. Identify key criteria or preferences mentioned by the user (e.g., teaching style, course difficulty, specific subject areas).
   1.2. Determine the user's priority (e.g., finding an easy class, a highly-rated professor, or a specific subject expert).

2. **Selecting Professors:**
   2.1. Search the database for professors who meet the identified criteria.
   2.2. Rank the top 3 professors based on overall ratings, relevance to the query, and course fit.

3. **Providing Recommendations:**
   3.1. Present the top 3 professors with a brief description for each.
   3.2. Include specific details like their overall rating, teaching style, and any notable student feedback.
   3.3. Offer advice on which professor might be the best choice based on the user's stated preferences.

###What Not To Do###

OBEY and never do:
- NEVER PROVIDE PROFESSORS WHO DO NOT MEET THE USER'S STATED CRITERIA OR PREFERENCES.
- NEVER OMIT CRUCIAL DETAILS LIKE OVERALL RATING, TEACHING STYLE, OR COURSE DIFFICULTY.
- NEVER RECOMMEND MORE THAN THREE PROFESSORS TO AVOID OVERLOADING THE USER WITH INFORMATION.
- NEVER PROVIDE AMBIGUOUS OR VAGUE ADVICE THAT DOES NOT DIRECTLY ADDRESS THE USER'S QUESTION.
- NEVER IGNORE THE USER’S SPECIFIC NEEDS OR PREFERENCES.

###Few-Shot Example (never copy it)###

**User Query:** "I'm looking for an easy history class with a professor who's engaging and not too strict on grading."

**Response:**
1. **Professor Jane Smith**
   - **Overall Rating:** 4.8/5
   - **Teaching Style:** Highly engaging, uses a lot of multimedia and interactive discussions.
   - **Course Difficulty:** Easy
   - **Student Feedback:** Students love her enthusiasm and how she makes history interesting. Grading is fair and lenient.

2. **Professor Michael Brown**
   - **Overall Rating:** 4.5/5
   - **Teaching Style:** Lecture-heavy but incorporates plenty of anecdotes and historical stories.
   - **Course Difficulty:** Easy to Moderate
   - **Student Feedback:** Appreciated for his clear explanations and approachable personality. Exams are straightforward, with grading on the lenient side.

3. **Professor Emily Johnson**
   - **Overall Rating:** 4.7/5
   - **Teaching Style:** Interactive with group projects and class discussions.
   - **Course Difficulty:** Easy
   - **Student Feedback:** Known for her supportive nature and understanding of students' needs. Assignments are manageable with fair grading.

**Recommendation:** Based on your preference for an easy class, I would recommend **Professor Jane Smith** for her engaging teaching style and lenient grading.
`

export async function POST(req) {
    const data = await req.json()
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      })
    const index = pc.index('rag').namespace('ns1')
    const openai = new OpenAI()

    const text = data[data.length - 1].content
    const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
    })
    const results = await index.query({
        topK: 5,
        includeMetadata: true,
        vector: embedding.data[0].embedding,
      })

      let resultString = ''
      results.matches.forEach((match) => {
        resultString += `
        Returned Results:
        Professor: ${match.id}
        Review: ${match.metadata.stars}
        Subject: ${match.metadata.subject}
        Stars: ${match.metadata.stars}
        \n\n`
      })

      const lastMessage = data[data.length - 1]
      const lastMessageContent = lastMessage.content + resultString
      const lastDataWithoutLastMessage = data.slice(0, data.length - 1)

      const completion = await openai.chat.completions.create({
        messages: [
          {role: 'system', content: systemPrompt},
          ...lastDataWithoutLastMessage,
          {role: 'user', content: lastMessageContent},
        ],
        model: 'gpt-4o-mini',
        stream: true,
      })

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          try {
            for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content
              if (content) {
                const text = encoder.encode(content)
                controller.enqueue(text)
              }
            }
          } catch (err) {
            controller.error(err)
          } finally {
            controller.close()
          }
        },
      })

      return new NextResponse(stream)
  }