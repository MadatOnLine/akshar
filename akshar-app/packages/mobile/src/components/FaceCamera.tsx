/**

 * FaceCamera — live front camera + frame extraction for liveness.

 */

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

import { StyleSheet, View, Text } from 'react-native';

import {

  Camera,

  useCameraDevice,

  useCameraPermission,

  useFrameProcessor,

  type CameraDevice,

} from 'react-native-vision-camera';

import { useResizePlugin } from 'vision-camera-resize-plugin';

import { Worklets } from 'react-native-worklets-core';

import { setLatestFrames } from '../services/frame-bridge';



export interface FaceCameraRef {

  getFrame32: () => Float32Array | null;

  getFrame8: () => number[] | null;

  isReady: () => boolean;

}



interface FaceCameraProps {

  active: boolean;

}



function rgbToGray(r: number, g: number, b: number): number {

  return 0.299 * r + 0.587 * g + 0.114 * b;

}



function bufferToGray32(rgb: Uint8Array): Float32Array {

  const out = new Float32Array(1024);

  for (let i = 0; i < 1024; i++) {

    const o = i * 3;

    out[i] = rgbToGray(rgb[o], rgb[o + 1], rgb[o + 2]);

  }

  return out;

}



function bufferToGray8(rgb: Uint8Array): number[] {

  const out: number[] = [];

  for (let i = 0; i < 64; i++) {

    const o = i * 3;

    out.push(rgbToGray(rgb[o], rgb[o + 1], rgb[o + 2]));

  }

  return out;

}



function CameraPlaceholder({ message }: { message: string }) {

  return (

    <View style={styles.placeholder}>

      <Text style={styles.hint}>{message}</Text>

    </View>

  );

}



const FaceCameraStream = forwardRef<FaceCameraRef, { active: boolean; device: CameraDevice }>(

  ({ active, device }, ref) => {

    const cameraRef = useRef<Camera>(null);

    const { resize } = useResizePlugin();

    const readyRef = useRef(false);



    const publishFrames = Worklets.createRunOnJS((

      rgb32: Uint8Array,

      rgb8: Uint8Array,

    ) => {

      setLatestFrames(bufferToGray32(rgb32), bufferToGray8(rgb8));

      readyRef.current = true;

    });



    const frameProcessor = useFrameProcessor((frame) => {

      'worklet';

      try {

        const small32 = resize(frame, {

          scale: { width: 32, height: 32 },

          pixelFormat: 'rgb',

          dataType: 'uint8',

        }) as Uint8Array;

        const small8 = resize(frame, {

          scale: { width: 8, height: 8 },

          pixelFormat: 'rgb',

          dataType: 'uint8',

        }) as Uint8Array;

        publishFrames(small32, small8);

      } catch {

        // Frame dropped — camera may still be starting on emulator.

      }

    }, [resize, publishFrames]);



    useImperativeHandle(ref, () => ({

      getFrame32: () => null,

      getFrame8: () => null,

      isReady: () => readyRef.current && active,

    }));



    return (

      <Camera

        ref={cameraRef}

        style={StyleSheet.absoluteFill}

        device={device}

        isActive={active}

        frameProcessor={frameProcessor}

        photo={false}

      />

    );

  },

);



export const FaceCamera = forwardRef<FaceCameraRef, FaceCameraProps>(

  ({ active }, ref) => {

    const { hasPermission, requestPermission } = useCameraPermission();

    const frontDevice = useCameraDevice('front');

    const backDevice = useCameraDevice('back');

    const device = frontDevice ?? backDevice;



    useEffect(() => {

      if (!hasPermission) {

        requestPermission();

      }

    }, [hasPermission, requestPermission]);



    if (!hasPermission) {

      return <CameraPlaceholder message="Allow camera permission to continue" />;

    }



    if (!device) {

      return (

        <CameraPlaceholder message="No camera detected — in emulator: Extended Controls → Camera → Webcam0, then cold boot" />

      );

    }



    return <FaceCameraStream ref={ref} active={active} device={device} />;

  },

);



const styles = StyleSheet.create({

  placeholder: {

    ...StyleSheet.absoluteFillObject,

    backgroundColor: '#05080d',

    alignItems: 'center',

    justifyContent: 'center',

    padding: 16,

  },

  hint: {

    color: '#9aa3b2',

    textAlign: 'center',

    fontSize: 14,

  },

});


