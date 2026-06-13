import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #1E40AF 0%, #1E3A8A 100%)',
          borderRadius: 36,
          color: 'white',
          fontSize: 72,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: -2,
        }}
      >
        SM
      </div>
    ),
    { ...size },
  );
}
