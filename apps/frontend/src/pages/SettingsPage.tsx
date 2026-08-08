/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { api, getApiErrorMessage, resolveMediaUrl } from '../lib/api';
import { getManagedAvatarPath, getNicknameInitials } from '../lib/avatar';
import type { UserDto } from '../lib/types';

const MAX_AVATAR_SIZE_BYTES = 4 * 1024 * 1024;

type DragState = 'idle' | 'active';

type PointerDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  baseOffsetX: number;
  baseOffsetY: number;
};

type CropImageMeta = {
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image preview'));
    image.src = dataUrl;
  });
}

async function cropSquareImage(
  dataUrl: string,
  zoom: number,
  offsetX: number,
  offsetY: number,
  fitMode: 'contain' | 'cover' = 'contain',
): Promise<File> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  const size = 512;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas is not supported by this browser');
  }

  const baseScaleFactory = fitMode === 'cover' ? Math.max : Math.min;
  const baseScale = baseScaleFactory(size / image.width, size / image.height) * zoom;
  const drawWidth = image.width * baseScale;
  const drawHeight = image.height * baseScale;
  const drawX = (size - drawWidth) / 2 + offsetX;
  const drawY = (size - drawHeight) / 2 + offsetY;

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.92);
  });

  if (!blob) {
    throw new Error('Failed to export cropped image');
  }

  return new File([blob], `avatar-${Date.now()}.webp`, { type: 'image/webp' });
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SettingsPage() {
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<UserDto>('/me')).data,
  });

  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [selectedAvatarPreview, setSelectedAvatarPreview] = useState<string | null>(null);

  const [rawCropImage, setRawCropImage] = useState<string | null>(null);
  const [cropImageMeta, setCropImageMeta] = useState<CropImageMeta | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [isCropping, setIsCropping] = useState(false);

  const [dragState, setDragState] = useState<DragState>('idle');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const pointerDragRef = useRef<PointerDrag | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!meQuery.data) return;
    setNickname(meQuery.data.nickname ?? '');
    setBio(meQuery.data.bio ?? '');
  }, [meQuery.data]);

  useEffect(() => {
    return () => {
      if (selectedAvatarPreview) {
        URL.revokeObjectURL(selectedAvatarPreview);
      }
    };
  }, [selectedAvatarPreview]);

  useEffect(() => {
    const resetDrag = () => {
      dragDepthRef.current = 0;
      setDragState('idle');
    };

    window.addEventListener('drop', resetDrag);
    window.addEventListener('dragend', resetDrag);

    return () => {
      window.removeEventListener('drop', resetDrag);
      window.removeEventListener('dragend', resetDrag);
    };
  }, []);

  const resolvedAvatarUrl = useMemo(() => resolveMediaUrl(getManagedAvatarPath(meQuery.data?.avatarUrl)), [meQuery.data?.avatarUrl]);
  const cropPreviewSize = 256;
  const cropBaseScale = useMemo(() => {
    if (!cropImageMeta) return 1;
    return Math.min(cropPreviewSize / cropImageMeta.width, cropPreviewSize / cropImageMeta.height);
  }, [cropImageMeta]);
  const cropDisplayWidth = cropImageMeta ? cropImageMeta.width * cropBaseScale : cropPreviewSize;
  const cropDisplayHeight = cropImageMeta ? cropImageMeta.height * cropBaseScale : cropPreviewSize;

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      return (await api.patch<UserDto>('/me', { nickname, bio })).data;
    },
    onSuccess: async (updated) => {
      setProfileMessage('Profile updated successfully.');
      setNickname(updated.nickname ?? '');
      setBio(updated.bio ?? '');
      await meQuery.refetch();
    },
    onError: (error) => {
      setProfileMessage(getApiErrorMessage(error));
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAvatarFile) {
        throw new Error('Choose and crop an image first');
      }
      const formData = new FormData();
      formData.append('file', selectedAvatarFile);
      return (
        await api.post<UserDto>('/me/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data;
    },
    onSuccess: async () => {
      setSelectedAvatarFile(null);
      if (selectedAvatarPreview) {
        URL.revokeObjectURL(selectedAvatarPreview);
      }
      setSelectedAvatarPreview(null);
      setProfileMessage('Avatar uploaded successfully.');
      await meQuery.refetch();
    },
    onError: (error) => {
      setProfileMessage(getApiErrorMessage(error));
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/me/avatar');
    },
    onSuccess: async () => {
      setSelectedAvatarFile(null);
      if (selectedAvatarPreview) {
        URL.revokeObjectURL(selectedAvatarPreview);
      }
      setSelectedAvatarPreview(null);
      setProfileMessage('Avatar removed.');
      await meQuery.refetch();
    },
    onError: (error) => {
      setProfileMessage(getApiErrorMessage(error));
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async () => {
      return (await api.patch('/me/password', { currentPassword, newPassword })).data as { success: boolean };
    },
    onSuccess: () => {
      setPasswordMessage('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
    },
    onError: (error) => {
      setPasswordMessage(getApiErrorMessage(error));
    },
  });

  const resetCropState = () => {
    setRawCropImage(null);
    setCropImageMeta(null);
    setCropZoom(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
    setIsCropping(false);
    pointerDragRef.current = null;
  };

  const prepareCropFromFile = async (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileMessage('Only image files are supported.');
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setProfileMessage('Image is too large. Max size is 4 MB.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const image = await loadImage(dataUrl);
      setRawCropImage(dataUrl);
      setCropImageMeta({ width: image.width, height: image.height });
      setCropZoom(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
      setIsCropping(true);
      setProfileMessage('Adjust crop and click Apply crop.');
    } catch (error) {
      setProfileMessage(getApiErrorMessage(error));
    }
  };

  const applyCrop = async () => {
    if (!rawCropImage) return;

    try {
      const croppedFile = await cropSquareImage(rawCropImage, cropZoom, cropOffsetX, cropOffsetY, 'contain');
      setSelectedAvatarFile(croppedFile);
      if (selectedAvatarPreview) {
        URL.revokeObjectURL(selectedAvatarPreview);
      }
      setSelectedAvatarPreview(URL.createObjectURL(croppedFile));
      setProfileMessage('Crop ready. Click Upload avatar to save it.');
      resetCropState();
    } catch (error) {
      setProfileMessage(getApiErrorMessage(error));
    }
  };

  if (meQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Loading profile...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {getApiErrorMessage(meQuery.error)}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile settings</CardTitle>
          <CardDescription>Update your public profile details and avatar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="nickname" className="text-sm font-medium">Nickname</label>
              <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
              <p className="text-xs text-muted-foreground">Allowed: letters, numbers, underscore.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Avatar image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => void prepareCropFromFile(event.target.files?.[0] ?? null)}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragState('active');
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  dragDepthRef.current += 1;
                  setDragState('active');
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
                  if (dragDepthRef.current === 0) {
                    setDragState('idle');
                  }
                }}
                onDragEnd={() => {
                  dragDepthRef.current = 0;
                  setDragState('idle');
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  dragDepthRef.current = 0;
                  setDragState('idle');
                  void prepareCropFromFile(event.dataTransfer.files?.[0] ?? null);
                }}
                className={`rounded-md border border-dashed px-3 py-4 text-sm transition-colors ${
                  dragState === 'active'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                Drag & drop image here, or click to choose file
              </div>
              <p className="text-xs text-muted-foreground">Max 4 MB, JPG/PNG/WEBP. Crop is square (1:1).</p>
            </div>
          </div>

          {isCropping && rawCropImage ? (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Crop avatar (1:1)</p>
              <p className="text-xs text-muted-foreground">Drag image to reposition. Mouse wheel zoom works. Touch drag works on mobile. Use arrow keys for fine move and +/- for zoom.</p>

              <div
                tabIndex={0}
                role="application"
                aria-label="Avatar crop area"
                className="relative mx-auto aspect-square w-full max-w-64 overflow-hidden rounded-full border bg-muted shadow-sm touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onKeyDown={(event) => {
                  const isFine = event.shiftKey ? 12 : 4;
                  if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    setCropOffsetX((current) => clamp(current - isFine, -220, 220));
                    return;
                  }
                  if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    setCropOffsetX((current) => clamp(current + isFine, -220, 220));
                    return;
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setCropOffsetY((current) => clamp(current - isFine, -220, 220));
                    return;
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setCropOffsetY((current) => clamp(current + isFine, -220, 220));
                    return;
                  }
                  if (event.key === '+' || event.key === '=') {
                    event.preventDefault();
                    setCropZoom((current) => clamp(current + 0.05, 0.4, 3));
                    return;
                  }
                  if (event.key === '-' || event.key === '_') {
                    event.preventDefault();
                    setCropZoom((current) => clamp(current - 0.05, 0.4, 3));
                  }
                }}
                onWheel={(event) => {
                  const delta = event.deltaY > 0 ? -0.05 : 0.05;
                  setCropZoom((current) => clamp(current + delta, 0.4, 3));
                }}
                onPointerDown={(event) => {
                  pointerDragRef.current = {
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    baseOffsetX: cropOffsetX,
                    baseOffsetY: cropOffsetY,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const drag = pointerDragRef.current;
                  if (!drag || drag.pointerId !== event.pointerId) return;
                  const nextX = drag.baseOffsetX + (event.clientX - drag.startX);
                  const nextY = drag.baseOffsetY + (event.clientY - drag.startY);
                  setCropOffsetX(clamp(nextX, -220, 220));
                  setCropOffsetY(clamp(nextY, -220, 220));
                }}
                onPointerUp={(event) => {
                  if (pointerDragRef.current?.pointerId === event.pointerId) {
                    pointerDragRef.current = null;
                  }
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={(event) => {
                  if (pointerDragRef.current?.pointerId === event.pointerId) {
                    pointerDragRef.current = null;
                  }
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
              >
                <img
                  src={rawCropImage}
                  alt="Crop preview"
                  className="absolute left-1/2 top-1/2 max-w-none select-none"
                  draggable={false}
                  style={{
                    width: `${cropDisplayWidth}px`,
                    height: `${cropDisplayHeight}px`,
                    transform: `translate(calc(-50% + ${cropOffsetX}px), calc(-50% + ${cropOffsetY}px)) scale(${cropZoom})`,
                    transformOrigin: 'center center',
                  }}
                />
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <label className="text-xs text-muted-foreground">
                  Zoom: {cropZoom.toFixed(2)}x
                  <input
                    type="range"
                    min={0.4}
                    max={3}
                    step={0.01}
                    value={cropZoom}
                    onChange={(event) => setCropZoom(Number(event.target.value))}
                    className="mt-1 w-full"
                  />
                </label>

                <label className="text-xs text-muted-foreground">
                  Horizontal offset: {cropOffsetX}px
                  <input
                    type="range"
                    min={-220}
                    max={220}
                    step={1}
                    value={cropOffsetX}
                    onChange={(event) => setCropOffsetX(Number(event.target.value))}
                    className="mt-1 w-full"
                  />
                </label>

                <label className="text-xs text-muted-foreground">
                  Vertical offset: {cropOffsetY}px
                  <input
                    type="range"
                    min={-220}
                    max={220}
                    step={1}
                    value={cropOffsetY}
                    onChange={(event) => setCropOffsetY(Number(event.target.value))}
                    className="mt-1 w-full"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void applyCrop()}>
                  Apply crop
                </Button>
                <Button type="button" variant="outline" onClick={resetCropState}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="bio" className="text-sm font-medium">Bio</label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Short bio (max 280 chars)"
            />
            <p className="text-xs text-muted-foreground">{bio.length}/280</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
            {selectedAvatarPreview ? (
              <img src={selectedAvatarPreview} alt="Selected avatar preview" className="h-14 w-14 rounded-full object-cover" />
            ) : resolvedAvatarUrl ? (
              <img src={resolvedAvatarUrl} alt="Avatar preview" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                {getNicknameInitials(meQuery.data.nickname)}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => uploadAvatarMutation.mutate()}
                disabled={!selectedAvatarFile || uploadAvatarMutation.isPending}
              >
                {uploadAvatarMutation.isPending ? 'Uploading...' : 'Upload avatar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => removeAvatarMutation.mutate()}
                disabled={!meQuery.data.avatarUrl || removeAvatarMutation.isPending}
              >
                {removeAvatarMutation.isPending ? 'Removing...' : 'Remove avatar'}
              </Button>
            </div>
          </div>

          {profileMessage ? <p className="text-sm text-muted-foreground">{profileMessage}</p> : null}

          <Button type="button" onClick={() => updateProfileMutation.mutate()} disabled={updateProfileMutation.isPending}>
            {updateProfileMutation.isPending ? 'Saving...' : 'Save profile'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Change your account password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <PasswordField
              id="currentPassword"
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
            <PasswordField
              id="newPassword"
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              hint="Use at least 8 characters. Any standard characters are allowed."
            />
          </div>

          {passwordMessage ? <p className="text-sm text-muted-foreground">{passwordMessage}</p> : null}

          <Button type="button" onClick={() => updatePasswordMutation.mutate()} disabled={updatePasswordMutation.isPending}>
            {updatePasswordMutation.isPending ? 'Updating...' : 'Update password'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


