"use client";

import { useEffect, useRef, useState } from "react";
import { isDemoSession, type DemoSession } from "@/lib/auth-types";
import { FACE_ENROLLMENT_SAMPLE_COUNT } from "@/lib/face-auth/match";

type FaceIdMode = "register" | "login";

interface FaceIdPanelProps {
  mode: FaceIdMode;
  attempt: number;
  onClose: () => void;
  onRetry: () => void;
  onUsePassword: () => void;
  onRegistered: () => void;
  onAuthenticated: (session: DemoSession) => void;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function cameraErrorMessage(cause: unknown): string {
  const name = typeof cause === "object" && cause !== null && "name" in cause
    ? cause.name
    : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return "Camera permission is required for Face ID.";
  }
  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "NotReadableError" ||
    name === "TrackStartError"
  ) {
    return "Camera unavailable. Use Email & Password.";
  }
  return "Camera unavailable. Use Email & Password.";
}

export function FaceIdPanel({
  mode,
  attempt,
  onClose,
  onRetry,
  onUsePassword,
  onRegistered,
  onAuthenticated,
}: FaceIdPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callbacksRef = useRef({ onRegistered, onAuthenticated });
  const [status, setStatus] = useState("Opening camera…");
  const [error, setError] = useState("");

  useEffect(() => {
    callbacksRef.current = { onRegistered, onAuthenticated };
  }, [onAuthenticated, onRegistered]);

  useEffect(() => {
    let active = true;
    let cameraRequestPending = false;
    const stopCamera = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    const fail = (message: string, cause?: unknown) => {
      if (cause) console.error("Face ID camera flow failed.", cause);
      stopCamera();
      if (active) {
        setError(message);
        setStatus("");
      }
    };

    const run = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          fail("Camera unavailable. Use Email & Password.");
          return;
        }
        cameraRequestPending = true;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        cameraRequestPending = false;
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (!videoRef.current) {
          fail("Camera preview could not be started. Use Email & Password.");
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("Loading face recognition…");

        const faceapi = await import("@vladmandic/face-api");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/face-models"),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri("/face-models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/face-models"),
        ]);
        if (!active || !videoRef.current) return;

        setStatus("Looking for your face…");
        const capturedDescriptors: number[][] = [];
        let lastSampleAt = 0;

        while (active) {
          const video = videoRef.current;
          if (!video || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
            await delay(150);
            continue;
          }
          const detections = await faceapi
            .detectAllFaces(
              video,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }),
            )
            .withFaceLandmarks(true)
            .withFaceDescriptors();
          if (!active) return;

          if (detections.length === 0) {
            capturedDescriptors.length = 0;
            setStatus("No face detected. Please look at the camera.");
          } else if (detections.length > 1) {
            capturedDescriptors.length = 0;
            setStatus("Please make sure only one person is visible.");
          } else {
            setStatus(
              mode === "register"
                ? `Face detected. Capturing sample ${capturedDescriptors.length + 1} of ${FACE_ENROLLMENT_SAMPLE_COUNT}…`
                : "Face detected. Verifying…",
            );
            const now = Date.now();
            if (now - lastSampleAt >= 350) {
              capturedDescriptors.push(Array.from(detections[0].descriptor));
              lastSampleAt = now;
            }
            if (capturedDescriptors.length >= FACE_ENROLLMENT_SAMPLE_COUNT) {
              const response = await fetch(
                mode === "register" ? "/api/auth/face/register" : "/api/auth/face/login",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    descriptors: capturedDescriptors.slice(0, FACE_ENROLLMENT_SAMPLE_COUNT),
                  }),
                  cache: "no-store",
                },
              );
              const payload: unknown = await response.json();
              if (!response.ok) {
                const message =
                  typeof payload === "object" &&
                  payload !== null &&
                  "error" in payload &&
                  typeof payload.error === "string"
                    ? payload.error
                    : mode === "login"
                      ? "Face not recognized. Try again or use Email & Password."
                      : "Face ID registration failed. Please try again.";
                fail(message);
                return;
              }
              stopCamera();
              if (mode === "register") {
                callbacksRef.current.onRegistered();
              } else if (
                typeof payload === "object" &&
                payload !== null &&
                "session" in payload &&
                isDemoSession(payload.session)
              ) {
                callbacksRef.current.onAuthenticated(payload.session);
              } else {
                fail("Face verification did not return a valid CampusX session.");
              }
              return;
            }
          }
          await delay(150);
        }
      } catch (cause) {
        if (cameraRequestPending) {
          fail(cameraErrorMessage(cause));
        } else {
          fail("Face recognition failed. Use Email & Password.", cause);
        }
      }
    };

    void run();
    return () => {
      active = false;
      stopCamera();
    };
  }, [attempt, mode]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={mode === "register" ? "Register Face ID" : "Login with Face ID"}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111a1b] p-5 shadow-2xl shadow-black/60"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {mode === "register" ? "Register Face ID" : "Login with Face ID"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Face ID"
            className="rounded-lg px-3 py-1 text-sm text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Live camera preview"
            className="h-full w-full scale-x-[-1] object-cover"
          />
          <div className="pointer-events-none absolute inset-x-[24%] inset-y-[12%] rounded-[45%] border-2 border-emerald-200/80 shadow-[0_0_28px_rgba(110,231,183,0.2)]" />
        </div>
        <p role={error ? "alert" : "status"} className={`mt-4 min-h-6 text-sm ${error ? "text-rose-200" : "text-emerald-100"}`}>
          {error || status}
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          CampusX processes your live camera frames in this browser and sends only face-recognition descriptors over HTTPS. No image or recording is uploaded.
        </p>
        {error ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-zinc-200 hover:border-emerald-200/30"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onUsePassword}
              className="rounded-xl bg-emerald-200 px-3 py-2.5 text-sm font-semibold text-[#10201a] hover:bg-emerald-100"
            >
              Use Email &amp; Password
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
