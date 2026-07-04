import React from 'react';
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';

export const FPS = 30;
const FADE_FRAMES = 9; // crossfade de 0.3s entre B-rolls
const ENDCARD_FRAMES = 90; // ultimos 3s

const AMARELO = '#FFE600';
const AMBAR = '#FFB020';
const FONTE = '"Arial Black", Arial, sans-serif';

export type Caption = {start: number; end: number; text: string};
export type ReelProps = {
  audioSeconds: number;
  clipCount: number;
  ctaWord: string;
  ctaSubtitle: string;
  captions: Caption[];
};

const Brolls: React.FC<{clipCount: number}> = ({clipCount}) => {
  const {durationInFrames} = useVideoConfig();
  const clipFrames = Math.ceil(
    (durationInFrames + (clipCount - 1) * FADE_FRAMES) / clipCount,
  );
  const items: React.ReactNode[] = [];
  for (let i = 0; i < clipCount; i++) {
    items.push(
      <TransitionSeries.Sequence key={`clip-${i}`} durationInFrames={clipFrames}>
        <OffthreadVideo
          muted
          src={staticFile(`clip-${String(i + 1).padStart(2, '0')}.mp4`)}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </TransitionSeries.Sequence>,
    );
    if (i < clipCount - 1) {
      items.push(
        <TransitionSeries.Transition
          key={`fade-${i}`}
          presentation={fade()}
          timing={linearTiming({durationInFrames: FADE_FRAMES})}
        />,
      );
    }
  }
  return <TransitionSeries>{items}</TransitionSeries>;
};

const Legenda: React.FC<{captions: Caption[]}> = ({captions}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  if (frame >= durationInFrames - ENDCARD_FRAMES) return null; // some no end card
  const t = frame / fps;
  const atual = captions.find((c) => t >= c.start && t < c.end);
  if (!atual) return null;
  const desde = frame - Math.round(atual.start * fps);
  const pop = spring({frame: desde, fps, config: {damping: 13, stiffness: 220}});
  const scale = 0.82 + 0.18 * pop;
  const sombra =
    '-6px -6px 0 #000, 6px -6px 0 #000, -6px 6px 0 #000, 6px 6px 0 #000, ' +
    '0 -8px 0 #000, 0 8px 0 #000, -8px 0 0 #000, 8px 0 0 #000, 0 0 24px rgba(0,0,0,0.55)';
  return (
    <AbsoluteFill style={{alignItems: 'center', pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          top: 300,
          width: '88%',
          textAlign: 'center',
          transform: `scale(${scale}) translateY(${(1 - pop) * 18}px)`,
          color: AMARELO,
          fontFamily: FONTE,
          fontWeight: 900,
          fontSize: 84,
          lineHeight: 1.12,
          textShadow: sombra,
        }}
      >
        {atual.text}
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ctaWord: string; ctaSubtitle: string}> = ({
  ctaWord,
  ctaSubtitle,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const inicio = durationInFrames - ENDCARD_FRAMES;
  if (frame < inicio) return null;
  const local = frame - inicio;
  const entrada = spring({frame: local, fps, config: {damping: 14}});
  const escurece = interpolate(local, [0, 14], [0, 0.92], {
    extrapolateRight: 'clamp',
  });
  const pulso = 1 + 0.045 * Math.sin(local / 4.2);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, rgba(10,8,4,${escurece * 0.85}) 40%, rgba(0,0,0,${escurece}) 100%)`,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 44,
      }}
    >
      <div
        style={{
          color: '#fff',
          fontFamily: FONTE,
          fontWeight: 900,
          fontSize: 84,
          opacity: entrada,
          transform: `translateY(${(1 - entrada) * 40}px)`,
          textShadow: '0 6px 30px rgba(0,0,0,0.8)',
        }}
      >
        Comenta
      </div>
      <div
        style={{
          background: `linear-gradient(180deg, ${AMARELO}, ${AMBAR})`,
          color: '#141006',
          fontFamily: FONTE,
          fontWeight: 900,
          fontSize: 130,
          letterSpacing: 6,
          padding: '26px 90px',
          borderRadius: 90,
          transform: `scale(${entrada * pulso})`,
          boxShadow:
            '0 0 70px rgba(255,176,32,0.55), 0 14px 40px rgba(0,0,0,0.6)',
        }}
      >
        {ctaWord}
      </div>
      <div
        style={{
          color: 'rgba(255,255,255,0.85)',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 700,
          fontSize: 42,
          opacity: entrada,
        }}
      >
        {ctaSubtitle}
      </div>
    </AbsoluteFill>
  );
};

export const Reel: React.FC<ReelProps> = ({clipCount, ctaWord, ctaSubtitle, captions}) => {
  return (
    <AbsoluteFill style={{backgroundColor: '#0b0a08'}}>
      <Brolls clipCount={clipCount} />
      <OffthreadVideo
        muted
        transparent
        src={staticFile('eric-alpha.webm')}
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          height: 1320,
        }}
      />
      <Legenda captions={captions} />
      <EndCard ctaWord={ctaWord} ctaSubtitle={ctaSubtitle} />
      <Audio src={staticFile('fala.m4a')} />
    </AbsoluteFill>
  );
};
