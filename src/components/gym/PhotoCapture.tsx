import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, RotateCcw, Check, X } from 'lucide-react';

interface PhotoCaptureProps {
  onCapture: (photoData: string) => void;
  currentPhoto?: string;
}

export function PhotoCapture({ onCapture, currentPhoto }: PhotoCaptureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraAvailable(false);
        throw new Error('Your browser does not support camera capture.');
      }
      stopCamera();
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
      setStream(mediaStream);
      setCameraAvailable(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraAvailable(false);
      setError(
        err instanceof Error && err.message !== 'Permission denied'
          ? err.message
          : 'Could not access camera. Please ensure camera permissions are granted.'
      );
    }
  }, [stopCamera]);

  const handleOpen = () => {
    setIsOpen(true);
    setCapturedPhoto(null);
    setError(null);
    setTimeout(startCamera, 100);
  };

  const handleClose = () => {
    stopCamera();
    setCapturedPhoto(null);
    setIsOpen(false);
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setCapturedPhoto(result);
        setError(null);
        stopCamera();
      }
    };
    reader.onerror = () => {
      setError('Unable to read selected file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Resize to max 200x200 to keep payload small for API Gateway
        const maxSize = 200;
        const scale = Math.min(maxSize / video.videoWidth, maxSize / video.videoHeight);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const photoData = canvas.toDataURL('image/jpeg', 0.5);
        setCapturedPhoto(photoData);
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const confirmPhoto = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      handleClose();
    }
  };

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        {currentPhoto ? (
          <div className="relative">
            <img 
              src={currentPhoto} 
              alt="Client photo" 
              className="w-32 h-32 rounded-full object-cover border-4 border-primary/30"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 gap-1"
              onClick={handleOpen}
            >
              <Camera className="w-4 h-4" />
              Retake
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 border-dashed border-2"
            onClick={handleOpen}
          >
            <Camera className="w-8 h-8 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Take Photo</span>
          </Button>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Capture Photo
            </DialogTitle>
            <DialogDescription>
              Use your device camera to take a member photo. Grant permission if prompted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error ? (
              <div className="text-center py-8">
                <X className="w-12 h-12 mx-auto text-destructive mb-4" />
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" className="mt-4" onClick={startCamera}>
                  Try Again
                </Button>
              </div>
            ) : capturedPhoto ? (
              <div className="relative">
                <img 
                  src={capturedPhoto} 
                  alt="Captured" 
                  className="w-full rounded-lg"
                />
              </div>
            ) : (
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full"
                />
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label="Choose or capture photo"
              className="hidden"
              onChange={handleFileSelected}
              {...({ capture: 'environment' } as any)}
            />
            {cameraAvailable === false && !capturedPhoto && (
              <div className="space-y-3 text-center">
                <Button variant="secondary" onClick={handleChooseFile} className="gap-2">
                  <Camera className="w-4 h-4" />
                  Choose photo from device
                </Button>
                <p className="text-sm text-muted-foreground">
                  If the camera is unavailable, use the device photo picker to upload a picture.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              {capturedPhoto ? (
                <>
                  <Button variant="outline" onClick={retakePhoto} className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Retake
                  </Button>
                  <Button variant="hero" onClick={confirmPhoto} className="gap-2">
                    <Check className="w-4 h-4" />
                    Use Photo
                  </Button>
                </>
              ) : (
                <Button 
                  variant="hero" 
                  onClick={capturePhoto} 
                  className="gap-2"
                  disabled={!stream}
                >
                  <Camera className="w-4 h-4" />
                  Capture
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
