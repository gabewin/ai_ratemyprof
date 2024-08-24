'use client'
import Image from "next/image"
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { useState } from 'react'

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm the Rate My Professor support assistant. How can I help you today?`,
    },
  ])
  const [message, setMessage] = useState('')

  const sendMessage = async () => {
    setMessage('')
    setMessages((messages) => [
      ...messages,
      { role: 'user', content: message },
      { role: 'assistant', content: '' },
    ])

    const response = fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([...messages, { role: 'user', content: message }]),
    }).then(async (res) => {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let result = ''

      return reader.read().then(function processText({ done, value }) {
        if (done) {
          return result
        }
        const text = decoder.decode(value || new Uint8Array(), { stream: true })
        setMessages((messages) => {
          let lastMessage = messages[messages.length - 1]
          let otherMessages = messages.slice(0, messages.length - 1)
          return [
            ...otherMessages,
            { ...lastMessage, content: lastMessage.content + text },
          ]
        })
        return reader.read().then(processText)
      })
    })
  }

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      sx={{
        background: 'radial-gradient(circle, rgba(238,174,202,1) 0%, rgba(198,215,235,0.5887605042016807) 100%)', // Gradient background
        padding: 4,
      }}
    >
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: '#3a5c8f' }}>
        AI Rate My Professor
      </Typography>
      <Box
        flexGrow={1}
        width="100%"
        overflow="auto"
        maxHeight="100%"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.map((message, index) => (
          <Box
            key={index}
            display="flex"
            justifyContent={message.role === 'assistant' ? 'flex-start' : 'flex-end'}
            sx={{ px: 2 }}
          >
            <Box
              sx={{
                backgroundColor: message.role === 'assistant'
                  ? 'rgba(161,185,213,0.5)' // Slightly transparent background for assistant messages
                  : ' rgba(239,135,174,0.8)', // Slightly transparent background for user messages
                color: 'black',
                borderRadius: '12px', // Slightly rounded borders
                p: 2,
                maxWidth: '70%',
                backdropFilter: 'blur(5px)', // Adds a subtle blur effect
              }}
            >
              <Typography component="div">
                <article dangerouslySetInnerHTML={{ __html: message.content.replace("```html", "").replace("```", "") }} />
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
      <Stack direction="row" spacing={2} sx={{ width: '100%', mt: 2 }}>
        <TextField
          label="Message"
          fullWidth
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') {
              sendMessage();
            }
          }}
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '8px',
          }}
        />
        <Button variant="contained" onClick={sendMessage} sx={{ borderRadius: '8px' }}>
          Send
        </Button>
      </Stack>
    </Box>
  );
  


}  