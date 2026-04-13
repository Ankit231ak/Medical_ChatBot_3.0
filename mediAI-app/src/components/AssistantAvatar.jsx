import { useEffect, useRef } from 'react';

export default function AssistantAvatar({ state = 'normal', className = '', onClick }) {
  // state can be 'normal', 'listening', 'loading', 'error'

  const videoRefs = {
    normal: useRef(null),
    listening: useRef(null),
    loading: useRef(null),
    error: useRef(null),
  };

  // Play the active video, pause the others to save resources
  useEffect(() => {
    Object.entries(videoRefs).forEach(([key, ref]) => {
      if (ref.current) {
        if (key === state) {
          ref.current.play().catch(e => console.log('Autoplay prevented:', e));
        } else {
          ref.current.pause();
        }
      }
    });
  }, [state]);

  const videos = [
    { id: 'normal', src: '/videos/Normal.mp4' },
    { id: 'listening', src: '/videos/Listening.mp4' },
    { id: 'loading', src: '/videos/Loading.mp4' },
    { id: 'error', src: '/videos/Error.mp4' },
  ];

  return (
    <div className={`relative overflow-hidden rounded-full flex items-center justify-center group ${className}`}>
      {videos.map((vid) => (
        <video
          key={vid.id}
          ref={videoRefs[vid.id]}
          src={vid.src}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out mix-blend-screen scale-[2.1] translate-y-[15%] pointer-events-none ${state === vid.id ? 'opacity-100 z-0' : 'opacity-0 -z-10'
            }`}
          autoPlay
          muted
          playsInline
          loop
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload noplaybackrate nofullscreen"
        />
      ))}
      {/* Invisible Shield for Edge / Opera overlays */}
      <div className="absolute inset-0 z-[100] w-full h-full bg-transparent" style={{ pointerEvents: 'all' }} />
    </div>
  );
}
