import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';

/// Gallery/camera pick followed by a locked-ratio crop.
///
/// Used for Pro-Networx / Radio cover banners (wide) and can be reused for
/// square avatars. Returns null when the user cancels either step.
class ImageCropPicker {
  ImageCropPicker._();

  /// Cover banner ratio matches the Pro-Networx public profile (16∶6).
  static const coverAspect = CropAspectRatio(ratioX: 16, ratioY: 6);

  static const squareAspect = CropAspectRatio(ratioX: 1, ratioY: 1);

  static Future<File?> pickAndCrop({
    required BuildContext context,
    ImageSource source = ImageSource.gallery,
    CropAspectRatio aspectRatio = coverAspect,
    String title = 'Crop photo',
    int imageQuality = 90,
    int maxWidth = 2048,
  }) async {
    final picked = await ImagePicker().pickImage(
      source: source,
      imageQuality: imageQuality,
      maxWidth: maxWidth.toDouble(),
    );
    if (picked == null) return null;
    if (!context.mounted) return null;

    final scheme = Theme.of(context).colorScheme;
    final cropped = await ImageCropper().cropImage(
      sourcePath: picked.path,
      aspectRatio: aspectRatio,
      compressFormat: ImageCompressFormat.jpg,
      compressQuality: 88,
      maxWidth: maxWidth,
      uiSettings: [
        AndroidUiSettings(
          toolbarTitle: title,
          toolbarColor: scheme.surface,
          toolbarWidgetColor: scheme.onSurface,
          statusBarLight: scheme.brightness == Brightness.light,
          activeControlsWidgetColor: scheme.primary,
          initAspectRatio: CropAspectRatioPreset.ratio16x9,
          lockAspectRatio: true,
          hideBottomControls: false,
        ),
        IOSUiSettings(
          title: title,
          aspectRatioLockEnabled: true,
          resetAspectRatioEnabled: false,
          aspectRatioPickerButtonHidden: true,
          rotateButtonsHidden: false,
          doneButtonTitle: 'Done',
          cancelButtonTitle: 'Cancel',
        ),
      ],
    );
    if (cropped == null) return null;
    return File(cropped.path);
  }
}
