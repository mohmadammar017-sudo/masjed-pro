import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpenText } from 'lucide-react';
import { QuranReciter } from '../types';

type QuranRemoteCommandType = 'nextSurah' | 'previousSurah' | 'stopPlayback';

interface QuranRemoteCommand {
  id: number;
  type: QuranRemoteCommandType;
}

interface QuranAudioOverlayProps {
  reciter: QuranReciter;
  trackIndex: number;
  volume: number;
  onTrackChange: (nextIndex: number) => void;
  onVolumeChange: (nextVolume: number) => void;
  onBack: () => void;
  onComplete: () => void;
  remoteCommand?: QuranRemoteCommand | null;
}

type PlaybackState = 'loading' | 'playing' | 'paused' | 'blocked';

const QuranAudioOverlay: React.FC<QuranAudioOverlayProps> = ({
  reciter,
  trackIndex,
  volume,
  onTrackChange,
  onVolumeChange,
  onBack,
  onComplete,
  remoteCommand = null
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastHandledRemoteCommandIdRef = useRef<number | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('loading');
  const [progressPercent, setProgressPercent] = useState(0);

  const tracks = reciter.tracks;
  const safeTrackIndex = Math.min(trackIndex, Math.max(tracks.length - 1, 0));
  const track = tracks[safeTrackIndex];
  const hasNextTrack = safeTrackIndex < tracks.length - 1;

  const advance = useCallback(() => {
    if (hasNextTrack) {
      onTrackChange(safeTrackIndex + 1);
      return;
    }
    onComplete();
  }, [hasNextTrack, onComplete, onTrackChange, safeTrackIndex]);

  const goNextSurah = useCallback(() => {
    if (!tracks.length) return;
    if (hasNextTrack) {
      onTrackChange(safeTrackIndex + 1);
      return;
    }
    // In manual next command, loop to first surah instead of closing Quran mode.
    onTrackChange(0);
  }, [hasNextTrack, onTrackChange, safeTrackIndex, tracks.length]);

  const goPreviousSurah = useCallback(() => {
    if (safeTrackIndex <= 0) return;
    onTrackChange(safeTrackIndex - 1);
  }, [onTrackChange, safeTrackIndex]);

  const resumePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio
      .play()
      .then(() => {
        setPlaybackState('playing');
      })
      .catch(() => {
        setPlaybackState('blocked');
      });
  }, []);

  const pausePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setPlaybackState('paused');
  }, []);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      resumePlayback();
      return;
    }
    pausePlayback();
  }, [pausePlayback, resumePlayback]);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setProgressPercent(0);
    setPlaybackState('paused');
    onBack();
  }, [onBack]);

  useEffect(() => {
    if (!track) return;

    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.src = track.audioSrc;
    audio.currentTime = 0;
    audio.volume = Math.max(0, Math.min(volume, 1));
    audio.autoplay = true;
    audio.preload = 'auto';
    setPlaybackState('loading');
    setProgressPercent(0);

    audio.load();
    resumePlayback();

    return () => {
      audio.pause();
    };
  }, [resumePlayback, track, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(volume, 1));
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => advance();
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [advance]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (!duration || duration <= 0) {
        setProgressPercent(0);
        return;
      }
      setProgressPercent(Math.max(0, Math.min(100, (audio.currentTime / duration) * 100)));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleTimeUpdate);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleTimeUpdate);
    };
  }, [track]);

  useEffect(() => {
    if (!remoteCommand) return;
    if (lastHandledRemoteCommandIdRef.current === remoteCommand.id) return;
    lastHandledRemoteCommandIdRef.current = remoteCommand.id;

    if (remoteCommand.type === 'nextSurah') {
      goNextSurah();
      return;
    }

    if (remoteCommand.type === 'previousSurah') {
      goPreviousSurah();
      return;
    }

    stopPlayback();
  }, [goNextSurah, goPreviousSurah, remoteCommand, stopPlayback]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'PageDown', 'PageUp', 'Escape', 'Backspace'].includes(event.code)) {
        event.preventDefault();
      }

      if (event.code === 'ArrowRight' || event.code === 'PageDown') {
        goNextSurah();
        return;
      }

      if (event.code === 'ArrowLeft') {
        if (safeTrackIndex > 0) {
          onTrackChange(safeTrackIndex - 1);
        }
        return;
      }

      if (event.code === 'ArrowUp') {
        onVolumeChange(Math.min(1, volume + 0.05));
        return;
      }

      if (event.code === 'ArrowDown') {
        onVolumeChange(Math.max(0, volume - 0.05));
        return;
      }

      if (event.code === 'PageUp') {
        togglePlayback();
        return;
      }

      if (event.code === 'Escape' || event.code === 'Backspace') {
        stopPlayback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNextSurah, onTrackChange, onVolumeChange, safeTrackIndex, stopPlayback, togglePlayback, volume]);

  if (!track) return null;

  return (
    <div className="absolute inset-0 z-40 pointer-events-none" dir="rtl">
      <style>{`
        @keyframes quran-player-slide {
          from {
            opacity: 0;
            transform: translate3d(24px, -18px, 0) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes quran-equalizer {
          0%, 100% { transform: scaleY(0.4); opacity: 0.45; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>

      <audio ref={audioRef} preload="auto" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_84%,rgba(14,165,233,0.18),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(250,204,21,0.14),transparent_22%)] opacity-80"></div>

      <div className="absolute right-6 top-6 md:right-8 md:top-8 pointer-events-auto w-[min(34rem,calc(100%-3rem))] animate-[quran-player-slide_320ms_cubic-bezier(0.22,1,0.36,1)]">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-slate-950/70 shadow-[0_30px_80px_rgba(2,6,23,0.6)] backdrop-blur-2xl">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),transparent_45%,rgba(250,204,21,0.12))]"></div>
          <div className="absolute -top-16 -left-10 h-36 w-36 rounded-full bg-cyan-400/15 blur-3xl"></div>
          <div className="absolute -bottom-12 right-0 h-36 w-36 rounded-full bg-gold-400/12 blur-3xl"></div>
          <div
            className={`absolute top-5 right-5 h-2.5 w-2.5 rounded-full shadow-[0_0_18px_currentColor] ${
              playbackState === 'playing'
                ? 'bg-emerald-300 text-emerald-300'
                : playbackState === 'blocked'
                  ? 'bg-amber-300 text-amber-300'
                  : playbackState === 'paused'
                    ? 'bg-slate-300 text-slate-300'
                    : 'bg-cyan-300 text-cyan-300'
            }`}
          ></div>

          <div className="relative flex flex-col gap-5 p-6 md:p-7 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/8 text-gold-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
                  <BookOpenText className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <div className="text-[0.72rem] tracking-[0.45em] text-cyan-200/70">تِلَاوَةٌ قُرْآنِيَّة</div>
                  <h2 className="truncate text-2xl font-black font-cairo text-white">{track.title}</h2>
                  <div className="truncate text-sm text-slate-300">{track.subtitle}</div>
                </div>
              </div>

              <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-bold text-slate-200">
                {safeTrackIndex + 1} / {tracks.length}
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-[1.5rem] border border-white/8 bg-white/5 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-gold-100">{reciter.name}</div>
                <div className="truncate text-sm text-slate-300">{reciter.description}</div>
              </div>

              <div className="flex items-end gap-1.5 text-cyan-300" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((index) => (
                  <span
                    key={index}
                    className="w-1.5 rounded-full bg-current"
                    style={{
                      height: `${14 + index * 5}px`,
                      animation: `quran-equalizer ${0.8 + index * 0.14}s ease-in-out infinite`,
                      animationDelay: `${index * 0.12}s`
                    }}
                  ></span>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/8 bg-white/5 px-4 py-3.5">
              <div className="relative h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#facc15)] transition-[width] duration-500"
                  style={{ width: `${progressPercent}%` }}
                ></div>
                <div className="absolute inset-y-0 right-0 w-24 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.32),transparent)] opacity-80"></div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                {tracks.map((item, index) => (
                  <span
                    key={item.id}
                    className={`block h-2 rounded-full transition-all duration-500 ${
                      index === safeTrackIndex ? 'w-10 bg-gold-300 shadow-[0_0_16px_rgba(250,204,21,0.55)]' : index < safeTrackIndex ? 'w-4 bg-cyan-300/60' : 'w-4 bg-white/20'
                    }`}
                  ></span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuranAudioOverlay;
