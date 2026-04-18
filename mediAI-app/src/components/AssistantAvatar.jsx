import { useEffect, useRef, useState } from 'react';

export default function AssistantAvatar({
  state = 'normal',
  className = '',
  onClick,
  hoverToListen = false,
}) {
  // state can be 'normal', 'listening', 'loading', 'error'
  const [isHovered, setIsHovered] = useState(false);
  const activeState = hoverToListen && isHovered && state === 'normal' ? 'listening' : state;

  const videoRefs = {
    normal: useRef(null),
    listening: useRef(null),
    loading: useRef(null),
    error: useRef(null),
  };

  const playActiveVideo = () => {
    const activeVideo = videoRefs[activeState]?.current;
    activeVideo?.play().catch(() => {});
  };

  // Play the active video, pause the others to save resources
  useEffect(() => {
    Object.entries(videoRefs).forEach(([key, ref]) => {
      if (ref.current) {
        if (key === activeState) {
          ref.current.play().catch(() => {});
        } else {
          ref.current.pause();
        }
      }
    });
  }, [activeState]);

  // Mobile browsers sometimes pause background media after tab/app changes.
  useEffect(() => {
    const resume = () => playActiveVideo();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('touchstart', resume, { passive: true });
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('touchstart', resume);
    };
  }, [activeState]);

  const videos = [
    { id: 'normal', src: '/videos/Normal.mp4' },
    { id: 'listening', src: '/videos/Listening.mp4' },
    { id: 'loading', src: '/videos/Loading.mp4' },
    { id: 'error', src: '/videos/Error.mp4' },
  ];

  return (
    <div
      className={`relative overflow-hidden rounded-full flex items-center justify-center group ${className}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {videos.map((vid) => (
        <video
          key={vid.id}
          ref={videoRefs[vid.id]}
          src={vid.src}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out mix-blend-screen scale-[2.1] translate-y-[15%] pointer-events-none ${activeState === vid.id ? 'opacity-100 z-0' : 'opacity-0 -z-10'
            }`}
          autoPlay
          muted
          playsInline
          loop
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload noplaybackrate nofullscreen"
          onCanPlay={vid.id === activeState ? playActiveVideo : undefined}
        />
      ))}
      {/* Invisible Shield for Edge / Opera overlays */}
      <div className="absolute inset-0 z-[100] w-full h-full bg-transparent pointer-events-none" />
    </div>
  );
}
