import type { Exercise } from "../exercises/types";
import s from "./ExerciseDemo.module.css";

/** One looping GIF per exercise (two frames would be crossfaded). Kept behind one component so custom animations can replace it later. */
export function ExerciseDemo({ exercise }: { exercise: Exercise }) {
  if (!exercise.images.length)
    return <p className={s.none}>{exercise.custom ? "Custom exercises have no demonstration." : "No demonstration available."}</p>;
  return (
    <div className={s.demo} data-frames={exercise.images.length}>
      {exercise.images.map((src, i) => (
        <img key={src} src={src} alt={exercise.images.length === 1 ? `${exercise.name} demonstration` : i === 0 ? `${exercise.name}, start position` : `${exercise.name}, end position`} className={i === 1 ? s.second : s.first} loading="lazy" />
      ))}
    </div>
  );
}
