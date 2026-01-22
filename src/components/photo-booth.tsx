
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Download, QrCode, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import QRCode from 'qrcode';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Label } from '@/components/ui/label';

const PHOTO_OPTIONS = [1, 2, 3, 4];
const COUNTDOWN_FIRST = 5;
const COUNTDOWN_SUBSEQUENT = 3;
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxtJfAc31SfatpMtQzyq-K2BVOE5-1RywzEsb6fSxaKvy_0_JNOat45IofTJ4HnEQXT/exec";
const BORDER_SIZE = 10; // The size of the white border in pixels for the final image
const PREVIEW_BORDER_SIZE = 2; // The size of the white border in pixels for the preview
const FOOTER_HEIGHT = 120; // Height for the text footer on the final image

export function PhotoBooth() {
    const [numPhotos, setNumPhotos] = useState(3);
    const [isCapturing, setIsCapturing] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [capturedImages, setCapturedImages] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [webcamError, setWebcamError] = useState<string | null>(null);
    const [finalImage, setFinalImage] = useState<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isFlashing, setIsFlashing] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { toast } = useToast();

    const startWebcam = useCallback(async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { aspectRatio: 4 / 3 } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setWebcamError(null);
            } catch (error) {
                console.error("Error accessing webcam:", error);
                setWebcamError("Could not access webcam. Please check permissions and try again.");
                toast({
                    variant: "destructive",
                    title: "Webcam Error",
                    description: "Could not access webcam. Please allow camera permissions in your browser settings.",
                });
            }
        } else {
            setWebcamError("Your browser does not support webcam access.");
        }
    }, [toast]);

    useEffect(() => {
        startWebcam();
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [startWebcam]);

    const capturePhoto = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === 4) {
            const context = canvas.getContext('2d');
            if (context) {
                const videoWidth = video.videoWidth;
                const videoHeight = video.videoHeight;
                const targetAspectRatio = 4 / 3;

                let sourceX = 0;
                let sourceY = 0;
                let sourceWidth = videoWidth;
                let sourceHeight = videoHeight;

                // The video stream is portrait (e.g. 480x640)
                if (videoWidth < videoHeight) {
                    sourceHeight = videoWidth / targetAspectRatio;
                    sourceY = (videoHeight - sourceHeight) / 2;
                } else { // The video stream is landscape (e.g. 640x480 or wider)
                    sourceWidth = videoHeight * targetAspectRatio;
                    sourceX = (videoWidth - sourceWidth) / 2;
                }

                canvas.width = sourceWidth;
                canvas.height = sourceHeight;

                // Draw the cropped video frame onto the canvas
                context.drawImage(
                    video,
                    sourceX,
                    sourceY,
                    sourceWidth,
                    sourceHeight,
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

                return canvas.toDataURL('image/png');
            }
        }
        return null;
    }, []);

    const downloadImage = (href: string, filename: string) => {
        const link = document.createElement('a');
        link.href = href;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const uploadToDrive = useCallback(async (dataUrl: string) => {
        try {
            const base64 = dataUrl.split(",")[1];
            const mimeType = dataUrl.substring(dataUrl.indexOf(":") + 1, dataUrl.indexOf(";"));

            const body = {
                filename: `PicClick-booth-${new Date().toISOString()}.jpg`,
                mimeType: mimeType,
                base64: base64
            };

            const res = await fetch(WEB_APP_URL, {
                method: "POST",
                body: JSON.stringify(body)
            });

            const json = await res.json();

            if (json.status === "success" && json.fileUrl) {
                const qr = await QRCode.toDataURL(json.fileUrl, { errorCorrectionLevel: 'H' });
                setQrCodeUrl(qr);
                setFinalImage(dataUrl);
                setShowModal(true);
            } else {
                throw new Error(json.message || "Failed to get file URL from Google Drive.");
            }
        } catch (error) {
            console.error("Upload failed:", error);
            toast({
                variant: "destructive",
                title: "Upload Failed",
                description: `Could not upload image to Google Drive. Downloading to device instead.`,
            });
            // Fallback to direct download if upload fails
            downloadImage(dataUrl, `PicClick-booth-${new Date().toISOString()}.jpg`);
        }

    }, [toast]);

    const handleMergeAndProcess = useCallback(async (images: string[]) => {
        if (images.length === 0 || !canvasRef.current) return;
        setIsProcessing(true);

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) {
            setIsProcessing(false);
            return;
        };

        try {
            const loadedImages: HTMLImageElement[] = await Promise.all(
                images.map(src => new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = src;
                }))
            );

            if (loadedImages.length === 0) return;

            const { width, height } = loadedImages[0];
            const totalImageHeight = height * loadedImages.length;
            const totalBorderHeight = BORDER_SIZE * (loadedImages.length + 1);

            canvas.width = width + (BORDER_SIZE * 2);
            canvas.height = totalImageHeight + totalBorderHeight + FOOTER_HEIGHT + BORDER_SIZE;

            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, canvas.width, canvas.height);

            let y = BORDER_SIZE;
            loadedImages.forEach(img => {
                context.drawImage(img, BORDER_SIZE, y);
                y += height + BORDER_SIZE;
            });

            // Draw footer text
            const footerY = y + (FOOTER_HEIGHT / 2);
            context.fillStyle = '#000000';
            context.textAlign = 'center';

            // Draw "Μιλένα & Χρίστος"
            context.font = '40px Poppins';
            context.fillText('Μιλένα & Χρίστος', canvas.width / 2, footerY - 10);

            // Draw "06.06.2026"
            context.font = '30px Poppins';
            context.fillText('06.06.2026', canvas.width / 2, footerY + 30);


            const mergedImage = canvas.toDataURL('image/jpeg', 0.9);

            await uploadToDrive(mergedImage);


        } catch (error) {
            console.error("Failed to merge images:", error);
            toast({
                variant: "destructive",
                title: "Processing Failed",
                description: "Could not create the final image. Please try again.",
            });
        } finally {
            setIsProcessing(false);
            setIsCapturing(false);
        }
    }, [toast, uploadToDrive]);

    const triggerFlash = () => {
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 300);
    }

    const handleStartCapture = async () => {
        if (!videoRef.current?.srcObject) {
            toast({
                variant: "destructive",
                title: "No Camera Found",
                description: "Please ensure your webcam is enabled and permissions are granted.",
            });
            startWebcam();
            return;
        }

        setIsCapturing(true);
        const newImages: string[] = [];
        setCapturedImages([]);

        for (let i = 0; i < numPhotos; i++) {
            const timer = i === 0 ? COUNTDOWN_FIRST : COUNTDOWN_SUBSEQUENT;
            for (let j = timer; j > 0; j--) {
                setCountdown(j);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            setCountdown(null);

            triggerFlash();
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for flash to be visible

            const imageData = capturePhoto();
            if (imageData) {
                newImages.push(imageData);
                setCapturedImages([...newImages]);
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (newImages.length > 0) {
            handleMergeAndProcess(newImages);
        } else {
            setIsCapturing(false);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setFinalImage(null);
        setQrCodeUrl('');
        setCapturedImages([]);
    };

    const [style, setStyle] = useState({});

    useEffect(() => {
        alert('width: ' + document.documentElement.clientWidth);
        alert('height: ' + document.documentElement.clientHeight)
    }, []);

    useEffect(() => {
        const screenWidth = document.documentElement.clientWidth;
        const screenHeight = document.documentElement.clientHeight;

        const availableWidthForVideo = screenWidth * 0.7;
        const availableHeightForVideo = screenHeight - 150;

        let videoWidth = availableWidthForVideo;
        let videoHeight = availableWidthForVideo * 3 / 4;

        if (availableWidthForVideo / availableHeightForVideo > 4 / 3) {
            videoHeight = availableHeightForVideo;
            videoWidth = availableHeightForVideo * 4 / 3;
        }

        const availableWidthForPreviewPhoto = screenWidth * 0.3 - 8;

        const availableHeightForPreviewPhoto = (screenHeight / numPhotos) - ((numPhotos + 1) * 4);

        let previewPhotoWidth = availableWidthForPreviewPhoto;
        let previewPhotoHeight = availableWidthForPreviewPhoto * 3 / 4;

        if (availableWidthForPreviewPhoto / availableHeightForPreviewPhoto > 4 / 3) {
            previewPhotoHeight = availableHeightForPreviewPhoto;
            previewPhotoWidth = availableHeightForPreviewPhoto * 4 / 3;
        }

        const style = {
            pageContainer: {
                display: 'flex',
                gap: '8px',
                height: '100%'
            },
            leftColumn: {
                width: '70%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '8px'
            },
            rightColumn: {
                width: 'calc(30% - 8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                flexDirection: 'column'
            },
            videoContainer: {
                width: `${videoWidth}px`,
                height: `${videoHeight}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            },
            video: {
                width: `${videoWidth}px`,
                height: `${videoHeight}px`,
            },
            previewPhoto: {
                width: `${previewPhotoWidth}px`,
                height: `${previewPhotoHeight}px`,
                objectFit: 'contain',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',

            }
        };

        setStyle(style)
    }, []);







    return (
        <div className="pageContainer" style={style.pageContainer}>
            {/* Left Column */}
            <div className="leftColumn" style={style.leftColumn}>
                <div className="videoContainer" style={style.videoContainer}>
                    <video ref={videoRef} autoPlay muted playsInline style={style.video}></video>
                    {isFlashing && (
                        <div className="absolute inset-0 bg-white/80" style={{ animation: 'ping 200ms cubic-bezier(0, 0, 0.2, 1) forwards' }}></div>
                    )}
                    {countdown !== null && (
                        <div className="absolute top-4 left-4 transition-opacity duration-300">
                            <span className="text-white text-9xl font-bold font-headline" style={{ textShadow: '0 0 10px rgba(0,0,0,0.7)' }}>{countdown}</span>
                        </div>
                    )}
                    {webcamError && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center text-white p-4">
                            <Camera size={48} className="mb-4 text-destructive" />
                            <p className="font-bold font-headline">{webcamError}</p>
                            <Button onClick={startWebcam} className="mt-4">Try Again</Button>
                        </div>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-center w-full">
                    <div className="flex-shrink-0">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="lg" className="w-full sm:w-auto" disabled={isCapturing}>
                                    <Settings className="mr-2 h-5 w-5" />
                                    <span>{numPhotos} Photos</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuLabel>Number of Photos</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuRadioGroup value={String(numPhotos)} onValueChange={(val) => setNumPhotos(Number(val))}>
                                    {PHOTO_OPTIONS.map(opt => (
                                        <DropdownMenuRadioItem key={opt} value={String(opt)}>
                                            {opt} Photo{opt > 1 ? 's' : ''}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <Button onClick={handleStartCapture} disabled={isCapturing || isProcessing || !!webcamError} size="lg" className="w-full font-headline text-lg py-7 rounded-xl shadow-md transition-all hover:scale-105 active:scale-100 flex-grow">
                        {isProcessing ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                        ) : isCapturing ? (
                            "Say Cheese!"
                        ) : (
                            "Start Photo Session"
                        )}
                    </Button>
                </div>
            </div>

            {/* Right Column */}
            <div className="rightColumn" style={style.rightColumn}>
                {Array.from({ length: numPhotos }).map((_, index) => {
                    const imageSrc = capturedImages[index];
                    return (
                        imageSrc ? (
                            <img src={imageSrc} alt={`Captured photo ${index + 1}`} className="previewPhoto" style={style.previewPhoto} />
                        ) : (
                            <div className="previewPhoto" style={style.previewPhoto}>
                                <Camera className="w-16 h-16 text-muted-foreground/50" />
                            </div>
                        )
                    )
                })}
            </div>

            <canvas ref={canvasRef} className="hidden"></canvas>

            <Dialog open={showModal} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-4xl max-h-[95vh] max-w-[95vw] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="font-headline text-2xl">Your Photo Is Ready!</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center flex-1 min-h-0">
                        <div className="flex flex-col items-center justify-center h-full min-h-0">
                            {finalImage && <img src={finalImage} alt="Final merged" className="rounded-md shadow-lg max-w-full max-h-full object-contain" />}
                        </div>
                        <div className="space-y-4 text-center flex flex-col items-center justify-center">
                            <h3 className="font-headline text-xl flex items-center justify-center gap-2"><QrCode /> Scan to Download</h3>
                            <div className="bg-white p-2 rounded-lg shadow-md inline-block">
                                {qrCodeUrl ? <img src={qrCodeUrl} alt="QR Code for download" /> : <Loader2 className="animate-spin" />}
                            </div>
                            <p className="text-sm text-muted-foreground">Scan this QR code with your phone or another device to download the image.</p>
                            <Button onClick={() => downloadImage(finalImage!, `PicClick-booth-${new Date().toISOString()}.jpg`)} className="w-full mt-4">
                                <Download className="mr-2 h-4 w-4" />
                                Download to This Device
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
