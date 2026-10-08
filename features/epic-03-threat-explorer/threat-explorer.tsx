"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, ChevronRight, Info, RotateCcw, ShieldCheck, ExternalLink, X } from "lucide-react";
import { useAuth } from "@/features/epic-01-access/auth-context";
import { recognitionNotice, spotTheThreatExamples, threatExplorerItems, type ThreatExplorerCode } from "./threat-explorer-data";
import { creditsFor } from "./photo-credits";
import styles from "./threat-explorer.module.css";

const pagePhotoCredits = creditsFor(threatExplorerItems.flatMap((threat) => [threat.image, ...threat.examples.map((item) => item.image)]));

type QuizState = { index: number; answer: ThreatExplorerCode | null; score: number; finished: boolean };

const initialQuiz: QuizState = { index: 0, answer: null, score: 0, finished: false };

function threatLabel(code: ThreatExplorerCode) {
  return threatExplorerItems.find((threat) => threat.code === code)?.label ?? code;
}

function Arrow({ direction }: { direction: "left" | "right" }) {
  const Icon = direction === "left" ? ArrowLeft : ArrowRight;
  return <Icon size={18} aria-hidden="true" />;
}

export function ThreatExplorer({ initialThreat }: { initialThreat?: ThreatExplorerCode }) {
  const { status, user } = useAuth();
  const initialIndex = initialThreat
    ? threatExplorerItems.findIndex((threat) => threat.code === initialThreat)
    : 0;
  const [selectedIndex, setSelectedIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [quiz, setQuiz] = useState<QuizState>(initialQuiz);
  const quizFocusRef = useRef<HTMLHeadingElement>(null);
  const moveQuizFocus = useRef(false);
  const selected = threatExplorerItems[selectedIndex];
  const question = spotTheThreatExamples[quiz.index];
  const answered = quiz.answer !== null;
  const answeredCorrectly = quiz.answer === question.threatCode;
  const isLastQuestion = quiz.index === spotTheThreatExamples.length - 1;

  useEffect(() => {
    // After "Next question", "See your score" or "Try again" the pressed button is gone, so move focus to the new heading.
    if (moveQuizFocus.current) {
      moveQuizFocus.current = false;
      quizFocusRef.current?.focus();
    }
  }, [quiz.index, quiz.finished]);

  const selectThreat = (index: number) => {
    setSelectedIndex(index);
  };

  const answerQuestion = (code: ThreatExplorerCode) => {
    if (answered) return;
    setQuiz({ ...quiz, answer: code, score: quiz.score + (code === question.threatCode ? 1 : 0) });
  };

  const nextQuestion = () => {
    moveQuizFocus.current = true;
    setQuiz(isLastQuestion ? { ...quiz, finished: true } : { ...quiz, index: quiz.index + 1, answer: null });
  };

  const restartQuiz = () => {
    moveQuizFocus.current = true;
    setQuiz(initialQuiz);
  };

  const reportHref = (code: ThreatExplorerCode | "unsure") => {
    const categoryCode = code === "physical_reef_damage" ? "physical_damage" : code;
    const destination = `/report-a-reef?threat=${categoryCode}`;
    return status === "authenticated" && user?.role === "observer"
      ? destination
      : `/login?next=${encodeURIComponent(destination)}`;
  };

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <h1>Reef threats</h1>
          <p>Meet the four threats facing Malaysia’s reefs. Know the signs. Observe safely.</p>
          <p className={styles.recognitionNotice}><Info size={14} aria-hidden="true" />{recognitionNotice}</p>
        </div>
      </header>

      <div className={styles.main}>
        <section className={styles.explorer} id="threats" aria-labelledby="threats-heading">
          <div className={styles.sectionHeader}>
            <h2 id="threats-heading">Explore a threat</h2>
            <div className={styles.carouselControls}>
              <p aria-live="polite">{selectedIndex + 1} of {threatExplorerItems.length}</p>
              <button type="button" aria-label="Previous threat" disabled={selectedIndex === 0} onClick={() => selectThreat(selectedIndex - 1)}><Arrow direction="left" /></button>
              <button type="button" aria-label="Next threat" disabled={selectedIndex === threatExplorerItems.length - 1} onClick={() => selectThreat(selectedIndex + 1)}><Arrow direction="right" /></button>
            </div>
          </div>

          <div className={styles.cardRail} role="group" aria-label="Supported reef threats">
            {threatExplorerItems.map((threat, index) => (
              <button
                className={styles.threatCard}
                key={threat.code}
                type="button"
                aria-label={`Explore ${threat.label}`}
                aria-pressed={selectedIndex === index}
                onClick={() => selectThreat(index)}
              >
                <Image src={threat.image} alt="" fill sizes="(max-width: 640px) 45vw, 280px" />
                <span className={styles.cardShade} aria-hidden="true" />
                <span className={styles.cardNumber}>{threat.number}</span><strong>{threat.label}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.detail} aria-live="polite" aria-labelledby="selected-threat-heading">
          <div className={styles.detailGallery} aria-label={`${selected.label} visual examples`}>
            {selected.examples.map((item, index) => (
              <figure className={styles.detailImage} key={item.image}>
                <Image src={item.image} alt={item.alt} fill sizes="(max-width: 640px) 50vw, 22vw" priority={selectedIndex === 0 && index === 0} />
                {item.caption && <figcaption>{item.caption}</figcaption>}
              </figure>
            ))}
          </div>
          <div className={styles.detailCopy}>
            <h2 id="selected-threat-heading">{selected.label}</h2><p className={styles.lead}>{selected.summary}</p>
            <div className={styles.factGrid}>
              <div><h3>What it looks like</h3><p>{selected.looksLike}</p></div>
              <div><h3>Why it matters</h3><p>{selected.impact}</p><a className={styles.factSource} href={selected.impactSource.url} target="_blank" rel="noreferrer">Fact source: {selected.impactSource.label}<ExternalLink size={12} aria-hidden="true" /></a></div>
            </div>
            <div className={styles.cues}><h3>Recognition cues</h3><ol>{selected.recognitionCues.map((cue, index) => <li key={cue}><span>0{index + 1}</span>{cue}</li>)}</ol></div>
            <aside className={styles.evidence} aria-label={`What to record for ${selected.label}`}><Camera size={20} aria-hidden="true" /><div><strong>What to record</strong><p>{selected.evidenceGuidance}</p></div></aside>
            <aside className={styles.safety}><ShieldCheck size={20} aria-hidden="true" /><div><strong>Observe safely</strong><p>{selected.safety}</p></div></aside>
            <Link className={styles.primaryAction} href={reportHref(selected.code)}>Report this threat <Arrow direction="right" /></Link>
          </div>
        </section>

        <section className={styles.quiz} aria-labelledby="spot-heading">
          <div className={styles.quizIntro}><h2 id="spot-heading">Spot the threat</h2><p>Small details reveal what is happening on a reef. Look at each illustration and choose the threat it shows.</p></div>
          <div className={styles.quizPanel}>
            <figure className={styles.quizImage}>
              <Image key={question.id} src={question.image} alt={answered ? question.imageAlt : question.questionAlt} fill sizes="(max-width: 900px) 100vw, 52vw" />
              <figcaption className={styles.illustrationTag}>Illustration</figcaption>
            </figure>
            <div className={styles.quizCopy}>
              {quiz.finished ? (
                <div className={styles.feedback} role="status">
                  <h3 ref={quizFocusRef} tabIndex={-1}>
                    {quiz.score === spotTheThreatExamples.length
                      ? `You spotted all ${spotTheThreatExamples.length}`
                      : `You spotted ${quiz.score} of ${spotTheThreatExamples.length}`}
                  </h3>
                  <p>Each threat leaves its own clues: colour for bleaching, snapped branches for damage, mesh and rope for ghost gear, and objects that do not belong for debris. Explore a threat above to compare real photographs.</p>
                  <div className={styles.feedbackActions}>
                    <button type="button" className={styles.nextExample} onClick={restartQuiz}>
                      Try again <RotateCcw size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={styles.quizProgress}>Question {quiz.index + 1} of {spotTheThreatExamples.length}</p>
                  <h3 ref={quizFocusRef} tabIndex={-1}>Which threat does this image show?</h3>
                  <div className={styles.answers} role="group" aria-label="Answer options">
                    {threatExplorerItems.map((threat) => {
                      const isCorrectOption = answered && threat.code === question.threatCode;
                      const isWrongChoice = answered && quiz.answer === threat.code && !isCorrectOption;
                      const optionClass = isCorrectOption ? styles.answerCorrect : isWrongChoice ? styles.answerWrong : answered ? styles.answerMuted : undefined;
                      return (
                        <button key={threat.code} className={optionClass} type="button" aria-disabled={answered} onClick={() => answerQuestion(threat.code)}>
                          <span>{threat.label}</span>
                          {isCorrectOption && <span className={styles.answerMark}><Check size={16} aria-hidden="true" />{quiz.answer === threat.code ? "Your answer, correct" : "Correct answer"}</span>}
                          {isWrongChoice && <span className={styles.answerMark}><X size={16} aria-hidden="true" />Your answer</span>}
                          {!answered && <ChevronRight size={18} aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className={styles.feedback} role="status">
                    {quiz.answer === null ? (
                      <p className={styles.quizHint}>Tap the threat you think this image shows.</p>
                    ) : (
                      <>
                        <p className={answeredCorrectly ? styles.resultCorrect : styles.resultWrong}>
                          {answeredCorrectly ? <Check size={20} aria-hidden="true" /> : <X size={20} aria-hidden="true" />}
                          {answeredCorrectly ? `Correct: ${threatLabel(question.threatCode)}` : `Not quite. This is ${threatLabel(question.threatCode)}.`}
                        </p>
                        {!answeredCorrectly && <p className={styles.wrongNote}>{question.wrongAnswerNotes[quiz.answer]}</p>}
                        <p className={styles.lookFor}><strong>What to look for</strong>{question.prompt}</p>
                        <p>{question.explanation}</p>
                        <div className={styles.feedbackActions}>
                          <button type="button" className={styles.nextExample} onClick={nextQuestion}>
                            {isLastQuestion ? "See your score" : "Next question"} <Arrow direction="right" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <details className={styles.photoCredits}>
          <summary>Image sources</summary>
          <p>Photographs are real recognition examples from reefs around the world, not records of Malaysian dive sites or ReefCare reports. The four &ldquo;Spot the threat&rdquo; images are illustrations generated for ReefCare. Impact facts are linked to their NOAA sources above.</p>
          <ul>
            {pagePhotoCredits.map((credit) => (
              <li key={credit.image}>
                <span>{credit.title}</span>
                <a href={credit.source} target="_blank" rel="noreferrer">{credit.author}</a> · <a href={credit.licenseUrl} target="_blank" rel="noreferrer">{credit.license}</a>
              </li>
            ))}
          </ul>
        </details>

        <section className={styles.unsure}>
          <h2>Not sure what you saw?</h2>
          <p>Share what you saw without guessing. A clear photo, place and simple description are enough to begin.</p>
          <Link className={styles.lightAction} href={reportHref("unsure")}>I’m not sure what I saw <Arrow direction="right" /></Link>
        </section>
      </div>
    </div>
  );
}
