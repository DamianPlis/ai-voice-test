import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

function Slider({ className, value, defaultValue, min = 0, max = 100, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const values = value ?? defaultValue ?? [min];
  return <SliderPrimitive.Root data-slot="slider" value={value} defaultValue={defaultValue} min={min} max={max} className={cn('ui-slider', className)} {...props}><SliderPrimitive.Track className="ui-slider-track"><SliderPrimitive.Range className="ui-slider-range" /></SliderPrimitive.Track>{values.map((_, index) => <SliderPrimitive.Thumb key={index} aria-label={props['aria-label']} className="ui-slider-thumb" />)}</SliderPrimitive.Root>;
}
export { Slider };
