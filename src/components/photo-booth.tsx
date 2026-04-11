
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Download, QrCode, Settings, Info, History  } from 'lucide-react';
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

const PHOTO_OPTIONS = [1, 2, 3];
const COUNTDOWN_FIRST = 5;
const COUNTDOWN_SUBSEQUENT = 3;
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxtJfAc31SfatpMtQzyq-K2BVOE5-1RywzEsb6fSxaKvy_0_JNOat45IofTJ4HnEQXT/exec";
const BORDER_SIZE = 10; // The size of the white border in pixels for the final image
const PREVIEW_BORDER_SIZE = 2; // The size of the white border in pixels for the preview
const FOOTER_HEIGHT = 120; // Height for the text footer on the final image
const HISTORY_URL = "https://drive.google.com/drive/folders/1U1mPoev7lGEJTlB0T2evFdMcNQPDTOrR?usp=sharing";

export function PhotoBooth() {
    const [numPhotos, setNumPhotos] = useState(3);
    const [isCapturing, setIsCapturing] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [capturedImages, setCapturedImages] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [webcamError, setWebcamError] = useState<string | null>(null);
    const [finalImage, setFinalImage] = useState<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [historyQrCodeUrl, setHistoryQrCodeUrl] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isFlashing, setIsFlashing] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const canStart = useRef(true)

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
                console.error("Σφάλμα πρόσβασης στην camera:", error);
                setWebcamError("Αδυναμία πρόσβασης στην camera. Παρακαλώ ελέγξτε τις άδειες χρήσης και προσπαθήστε ξανά.");
                toast({
                    variant: "destructive",
                    title: "Σφάλμα πρόσβασης στην camera",
                    description: "Αδυναμία πρόσβασης στην camera. Παρακαλώ επιτρέψτε στον browser την πρόσβαση στην camera.",
                });
            }
        } else {
            setWebcamError("Ο browser δεν υποστηρίζει την πρόσβαση στην camera.");
        }
    }, [toast]);

    useEffect(() => {
        startWebcam();

        const generateHistoryQr = async () => {
            try {
                const qr = await QRCode.toDataURL(HISTORY_URL, { errorCorrectionLevel: 'H' });
                setHistoryQrCodeUrl(qr);
            } catch (err) {
                console.error('Αδυναμία δημιουργίας QR code για το ιστορικώ των φωτογραφιών', err);
            }
        };
        generateHistoryQr();
        
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

                context.save();
                context.translate(canvas.width, 0);
                context.scale(-1, 1);

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
                filename: `milena-christos-wedding-photobooth-${new Date().toISOString()}.jpg`,
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
                throw new Error(json.message || "Αδυναμία λήψης συνδέσμου για τη φωτογραφία σας.");
            }
        } catch (error) {
            console.error("Upload failed:", error);
            toast({
                variant: "destructive",
                title: "Σφάλμα κατά το ανέβασμα της φωτογραφίας",
                description: `Το ανέβασμα της φωτογραφίας απέτυχε. Μπορείτε να την κατεβάσετε κατευθείαν στη συσκευή.`,
            });
            // Fallback to direct download if upload fails
            downloadImage(dataUrl, `milena-christos-wedding-photobooth-${new Date().toISOString()}.jpg`);
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
            // const footerBgSrc = '/photobooth_footer.png';
            const footerBgSrc = '/photobooth_footer.png';
            const [loadedImages, footerBg] = await Promise.all([
                Promise.all(images.map(src => new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = src;
                }))),
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = footerBgSrc;
                })
            ]);

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
            context.drawImage(footerBg, 0, y, canvas.width, FOOTER_HEIGHT + BORDER_SIZE);
            context.font = '40px Poppins';
            context.fillText('Μιλένα & Χρίστος', canvas.width / 2, footerY - 10);

            // Draw "06.06.2026"
            context.font = '30px Poppins';
            context.fillText('06.06.2026', canvas.width / 2, footerY + 30);


            const mergedImage = canvas.toDataURL('image/jpeg', 0.9);

            await uploadToDrive(mergedImage);


        } catch (error) {
            console.error("Αδυναμία δημιουργίας ενιαίας εικόνας:", error);
            toast({
                variant: "destructive",
                title: "Σφάλμα Διαδικασίας",
                description: "Σφάλμα στη δημιουργία της τελικής εικόνας. Παρακαλώ προσπαθήστε ξανά.",
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
        if (!canStart.current) return;
        canStart.current = false;
        if (!videoRef.current?.srcObject) {
            toast({
                variant: "destructive",
                title: "Δε βρέθηκε camera",
                description: "Παρακαλώ ελέγξε ότι η camera είναι ενεργοποιημένη και η πρόσβαση έχει δωθεί.",
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
        canStart.current = true;
    };

    const [style, setStyle] = useState({});

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
                flexDirection: 'column',
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
                objectFit: 'cover',
                transform: 'scaleX(-1)'
            },
            previewPhoto: {
                width: `${previewPhotoWidth}px`,
                height: `${previewPhotoHeight}px`,
                objectFit: 'contain',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundImage: "url('/heart_no_background.png')",
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'contain',
                backgroundPosition: 'center center',
                color: '#b6b6c44a'
            }
        };

        setStyle(style)
    }, []);

    useEffect(() => {
        const eventListenerFn = (e) => {
            if ((e.screenX === 1000 && e.screenY === 1000) || (e.screenX === 363 && e.screenY === 363)) {
                if (showModal || showInfoModal || showHistoryModal) {
                    closeModal();
                    setShowHistoryModal(false);
                    setShowInfoModal(false);
                    return;
                }
                handleStartCapture();
            }
        }
        window.addEventListener('click', eventListenerFn)

        return () => window.removeEventListener('click', eventListenerFn)
    }, [showModal, showInfoModal, showHistoryModal]);

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
                                    <span>{numPhotos} {numPhotos > 1 ? "Φωτογραφίες" : "Φωτογραφία"}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuLabel>Πλήθος Φωτογραφιών</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuRadioGroup value={String(numPhotos)} onValueChange={(val) => setNumPhotos(Number(val))}>
                                    {PHOTO_OPTIONS.map(opt => (
                                        <DropdownMenuRadioItem key={opt} value={String(opt)}>
                                            {opt} {opt > 1 ? 'Φωτογραφίες' : 'Φωτογραφία'}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline" size="lg" className="px-3" onClick={() => setShowInfoModal(true)} disabled={isCapturing || isProcessing}>
                           <Info className="h-5 w-5" />
                           <span className="sr-only">Οδηγίες</span>
                       </Button>
                       <Button variant="outline" size="lg" className="px-3" onClick={() => setShowHistoryModal(true)} disabled={isCapturing || isProcessing}>
                           <History className="h-5 w-5" />
                           <span className="sr-only">Ιστορικό</span>
                       </Button>
                    </div>
                    <Button onClick={handleStartCapture} disabled={isCapturing || isProcessing || !!webcamError} size="lg" className="w-full font-headline text-lg py-7 rounded-xl shadow-md transition-all hover:scale-105 active:scale-100 flex-grow">
                        {isProcessing ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Επεξεργασία...</>
                        ) : isCapturing ? (
                            "Say Cheese!"
                        ) : (
                            "Έναρξη"
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
                                <Camera className="w-16 h-16" />
                            </div>
                        )
                    )
                })}
            </div>

            <canvas ref={canvasRef} className="hidden"></canvas>

            <Dialog open={showModal} onOpenChange={closeModal}>
                <DialogContent style={{ width: "70vw", maxWidth: '70vw' }}>
                    <DialogHeader>
                        <DialogTitle className="font-headline text-2xl">Η φωτογραφία σας είναι έτοιμη!</DialogTitle>
                    </DialogHeader>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-around' }}>
                        <div style={{ maxWidth: '50%' }}>
                            {finalImage && <img src={finalImage} alt="Final merged" className="rounded-md shadow-lg" style={{ maxHeight: '80vh' }}/>}
                        </div>
                        <div className="space-y-4 text-center flex flex-col items-center justify-center" style={{ maxWidth: '50%' }}>
                            <h3 className="font-headline text-xl flex items-center justify-center gap-2"><QrCode /> Σαρώστε για Λήψη</h3>
                            <div className="bg-white p-2 rounded-lg shadow-md inline-block">
                                {qrCodeUrl ? <img src={qrCodeUrl} alt="QR Code for download" style={{ maxHeight: '30vh' }}/> : <Loader2 className="animate-spin" />}
                            </div>
                            <p className="text-sm text-muted-foreground">Σαρώστε το QR code με το κινητό σας για να κατεβάσετε την εικόνα.</p>
                            <Button onClick={() => downloadImage(finalImage!, `PicClick-booth-${new Date().toISOString()}.jpg`)} className="w-full mt-4">
                                <Download className="mr-2 h-4 w-4" />
                                Λήψη
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-headline text-2xl">Οδηγίες Χρήσης</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                        <p>Καλώς ήρθατε στο <strong>PicClick Booth</strong>!</p>
                        <ol className="list-decimal list-inside space-y-3">
                            <li>
                                <strong>Επιλογή Αριθμού Φωτογραφιών:</strong><br/>
                                Χρησιμοποιήστε το κουμπί ρυθμίσεων (<Settings className="inline h-4 w-4" />) για να επιλέξετε πόσες φωτογραφίες θα τραβήξετε.
                            </li>
                            <li>
                                <strong>Έναρξη:</strong><br/>
                                Πατήστε το κουμπί "Start Photo Session" για να ξεκινήσει η αντίστροφη μέτρηση.
                            </li>
                            <li>
                                <strong>Ποζάρετε!:</strong><br/>
                                Ετοιμαστείτε να ποζάρετε! Η κάμερα θα τραβήξει αυτόματα τις φωτογραφίες μετά την αντίστροφη μέτρηση.
                            </li>
                            <li>
                                <strong>Τελική Εικόνα:</strong><br/>
                                Μόλις ολοκληρωθεί η λήψη, οι φωτογραφίες σας θα συνδυαστούν σε μία τελική εικόνα.
                            </li>
                            <li>
                                <strong>Λήψη Φωτογραφίας:</strong><br/>
                                Στο παράθυρο που θα εμφανιστεί, σαρώστε τον κωδικό QR με το κινητό σας για να κατεβάσετε τη φωτογραφία, ή χρησιμοποιήστε το κουμπί "Download".
                            </li>
                        </ol>
                        <p className="text-center font-bold">Καλή διασκέδαση!</p>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-headline text-2xl">Ιστορικό Φωτογραφιών</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 text-center flex flex-col items-center justify-center">
                        <h3 className="font-headline text-xl">Σαρώστε για να δείτε όλες τις φωτογραφίες</h3>
                        <div className="bg-white p-2 rounded-lg shadow-md inline-block">
                            {historyQrCodeUrl ? <img src={historyQrCodeUrl} alt="QR Code for photo history" className="max-w-xs" /> : <Loader2 className="animate-spin h-24 w-24" />}
                        </div>
                        <p className="text-sm text-muted-foreground">Σαρώστε το QR code με το κινητό σας για να δείτε ολόκληρη τη συλλογή φωτογραφιών.</p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}