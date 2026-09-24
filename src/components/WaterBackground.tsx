import CommonOceanBackground from './CommonOceanBackground';

/**
 * WaterBackground — Backward compatibility proxy
 * Seamlessly forwards to the global high-contrast light-to-dark CommonOceanBackground.
 */
export default function WaterBackground({
  showSeaFloor = true,
  className = '',
}: {
  showSeaFloor?: boolean;
  className?: string;
}) {
  return <CommonOceanBackground className={className} />;
}
