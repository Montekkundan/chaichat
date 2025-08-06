import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Get parameters from URL
  const title = searchParams.get('title') || 'ChaiChat';
  const type = searchParams.get('type') || 'default'; // default, chat, playground, registry
  const description = searchParams.get('description') || 'AI-powered chat assistant for experimenting with different AI models';

  // Common styles
  const baseStyle = {
    display: 'flex',
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: '-.02em',
    fontWeight: 700,
    background: 'white',
  };

  const logoStyle = {
    left: 42,
    top: 42,
    position: 'absolute' as const,
    display: 'flex',
    alignItems: 'center',
  };

  const logoIconStyle = {
    width: 24,
    height: 24,
    background: 'black',
  };

  const logoTextStyle = {
    marginLeft: 8,
    fontSize: 20,
  };

  // Different layouts based on type
  if (type === 'chat' || type === 'playground' || type === 'registry') {
    return new ImageResponse(
      (
        <div style={baseStyle}>
          <div style={logoStyle}>
            <span style={logoIconStyle} />
            <span style={logoTextStyle}>
              chaichat.dev
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '20px 50px',
              margin: '0 42px',
              fontSize: title.length > 20 ? 35 : 40, // Smaller font for longer titles
              width: 'auto',
              maxWidth: 600,
              textAlign: 'center',
              backgroundColor: 'black',
              color: 'white',
              lineHeight: 1.3,
              borderRadius: 8,
            }}
          >
            {title}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  }

  // Default layout for home page and other pages
  return new ImageResponse(
    (
      <div style={baseStyle}>
        <div style={logoStyle}>
          <span style={logoIconStyle} />
          <span style={logoTextStyle}>
            chaichat.dev
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 42px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 60,
              fontWeight: 900,
              color: 'black',
              lineHeight: 1.2,
              marginBottom: 24,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 24,
              color: '#666',
              maxWidth: 600,
              lineHeight: 1.4,
            }}
          >
            {description}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
