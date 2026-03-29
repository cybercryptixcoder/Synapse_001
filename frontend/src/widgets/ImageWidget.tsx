export type ImageWidgetData = {
  query: string;
  url: string | null;
};

export function ImageWidget({ data }: { data: ImageWidgetData }) {
  if (!data.url) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a1a',
        borderRadius: 6,
        color: '#555',
        fontSize: 13,
        fontFamily: 'monospace',
      }}>
        Searching for &ldquo;{data.query}&rdquo;&hellip;
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      borderRadius: 6,
      background: '#111',
    }}>
      <img
        src={data.url}
        alt={data.query}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
        padding: '20px 10px 8px',
        color: '#d0d0d0',
        fontSize: 12,
        fontFamily: 'sans-serif',
        letterSpacing: '0.02em',
      }}>
        {data.query}
      </div>
    </div>
  );
}
