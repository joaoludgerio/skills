import {Composition} from 'remotion';
import {Reel, ReelProps, FPS} from './Reel';

const defaultProps: ReelProps = {
  audioSeconds: 60,
  clipCount: 12,
  ctaWord: 'PALAVRA',
  ctaSubtitle: 'que eu te mando no direct',
  captions: [],
};

export const Root: React.FC = () => {
  return (
    <Composition
      id="Reel"
      component={Reel}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
      calculateMetadata={({props}) => ({
        durationInFrames: Math.ceil(props.audioSeconds * FPS),
      })}
    />
  );
};
