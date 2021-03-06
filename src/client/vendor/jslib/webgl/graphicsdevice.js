// Copyright (c) 2011-2014 Turbulenz Limited
/* eslint indent:off, no-bitwise:off, yoda:off, no-var:off, wrap-iife:off, no-shadow:off, no-underscore-dangle:off,
  no-empty-function:off, quotes:off, strict:off, max-len:off, one-var:off, sort-vars:off,
  on-var-declaration-per-line:off
*/
/*global TurbulenzEngine*/
/*global TGALoader*/
/*global DDSLoader*/
/*global TARLoader*/
/*global Int8Array*/
/*global Int16Array*/
/*global Int32Array*/
/*global Uint8Array*/
/*global Uint8ClampedArray*/
/*global Uint16Array*/
/*global Uint32Array*/
/*global Float32Array*/
/*global ArrayBuffer*/
/*global DataView*/
/*global window*/
/*global debug*/

"use strict";

function isPowerOfTwo(n) {
  return (0 === (n & (n - 1)));
}
function nextHighestPowerOfTwo(x) {
  --x;
  for (var i = 1; i < 32; i <<= 1) {
    x |= x >> i;
  }
  return x + 1;
}

// -----------------------------------------------------------------------------
var TZWebGLTexture = (function () {
    function TZWebGLTexture() {
    }
    TZWebGLTexture.prototype.setData = function (data, face, level, x, y, w, h) {
        var gd = this._gd;
        var target = this._target;
        gd._temporaryBindTexture(target, this._glTexture);
        debug.assert(arguments.length === 1 || 3 <= arguments.length);
        if (3 <= arguments.length) {
            if (x === undefined) {
                x = 0;
            }
            if (y === undefined) {
                y = 0;
            }
            if (w === undefined) {
                w = (this.width - x);
            }
            if (h === undefined) {
                h = (this.height - y);
            }
            this.updateSubData(data, face, level, x, y, w, h);
        } else {
            this.updateData(data);
        }
        gd._temporaryBindTexture(target, null);
    };

    TZWebGLTexture.prototype.copyTexImage = function (x, y, w, h) {
        var gd = this._gd;
        var gl = gd._gl;
        var target = this._target;
        var format = this.format;
        var internalFormat;
        x = x || 0;
        y = y || 0;
        w = w || gd.width;
        h = h || gd.height;
        if (format === gd.PIXELFORMAT_R8G8B8A8) {
          internalFormat = gl.RGBA;
        } else if (format === gd.PIXELFORMAT_R8G8B8) {
          internalFormat = gl.RGB;
        } else {
          debug.assert(false, 'Unhandled format');
        }
        gd._temporaryBindTexture(target, this._glTexture);
        gl.copyTexImage2D(target, 0, internalFormat, x, y, w, h, 0);
        gd._temporaryBindTexture(target, null);
        this.width = w;
        this.height = h;
    };

    // Internal
    TZWebGLTexture.prototype.createGLTexture = function (data, no_data) {
        var gd = this._gd;
        var gl = gd._gl;

        var target;
        if (this.cubemap) {
            target = gl.TEXTURE_CUBE_MAP;
        } else if (this.depth > 1) {
            //target = gl.TEXTURE_3D;
            // 3D textures are not supported yet
            return false;
        } else {
            target = gl.TEXTURE_2D;
        }
        this._target = target;

        var gltex = gl.createTexture();
        this._glTexture = gltex;

        gd._temporaryBindTexture(target, gltex);

        var format = this.format;
        if (format === gd.PIXELFORMAT_RGBA32F || format === gd.PIXELFORMAT_RGB32F || format === gd.PIXELFORMAT_RGBA16F || format === gd.PIXELFORMAT_RGB16F) {
            // Linear filtering is not always supported for floating point formats
            gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

            if (this.mipmaps) {
                gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
            } else {
                gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            }
        } else {
            gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            if (this.mipmaps) {
                gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
            } else {
                gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }
        }

        gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        if (!no_data) {
          this.updateData(data);
        }

        gd._temporaryBindTexture(target, null);

        return true;
    };

    TZWebGLTexture.prototype.convertDataToRGBA = function (gl, data, internalFormat, gltype, srcStep) {
        var numPixels = (data.length / srcStep);
        var rgbaData = new Uint8Array(numPixels * 4);
        var offset = 0;
        var n, value, r, g, b, a;
        if (internalFormat === gl.LUMINANCE) {
            debug.assert(srcStep === 1);
            for (n = 0; n < numPixels; n += 1, offset += 4) {
                r = data[n];
                rgbaData[offset] = r;
                rgbaData[offset + 1] = r;
                rgbaData[offset + 2] = r;
                rgbaData[offset + 3] = 0xff;
            }
        } else if (internalFormat === gl.ALPHA) {
            debug.assert(srcStep === 1);
            for (n = 0; n < numPixels; n += 1, offset += 4) {
                a = data[n];
                rgbaData[offset] = 0xff;
                rgbaData[offset + 1] = 0xff;
                rgbaData[offset + 2] = 0xff;
                rgbaData[offset + 3] = a;
            }
        } else if (internalFormat === gl.LUMINANCE_ALPHA) {
            debug.assert(srcStep === 2);
            for (n = 0; n < numPixels; n += 2, offset += 4) {
                r = data[n];
                a = data[n + 1];
                rgbaData[offset] = r;
                rgbaData[offset + 1] = r;
                rgbaData[offset + 2] = r;
                rgbaData[offset + 3] = a;
            }
        } else if (gltype === gl.UNSIGNED_SHORT_5_6_5) {
            debug.assert(srcStep === 1);

            for (n = 0; n < numPixels; n += 1, offset += 4) {
                value = data[n];
                r = ((value >> 11) & 31);
                g = ((value >> 5) & 63);
                b = ((value) & 31);
                rgbaData[offset] = ((r << 3) | (r >> 2));
                rgbaData[offset + 1] = ((g << 2) | (g >> 4));
                rgbaData[offset + 2] = ((b << 3) | (b >> 2));
                rgbaData[offset + 3] = 0xff;
            }
            /* tslint:enable:no-bitwise */
        } else if (gltype === gl.UNSIGNED_SHORT_5_5_5_1) {
            debug.assert(srcStep === 1);

            for (n = 0; n < numPixels; n += 1, offset += 4) {
                value = data[n];
                r = ((value >> 11) & 31);
                g = ((value >> 6) & 31);
                b = ((value >> 1) & 31);
                a = ((value) & 1);
                rgbaData[offset] = ((r << 3) | (r >> 2));
                rgbaData[offset + 1] = ((g << 3) | (g >> 2));
                rgbaData[offset + 2] = ((b << 3) | (b >> 2));
                rgbaData[offset + 3] = (a ? 0xff : 0);
            }
            /* tslint:enable:no-bitwise */
        } else if (gltype === gl.UNSIGNED_SHORT_4_4_4_4) {
            debug.assert(srcStep === 1);

            for (n = 0; n < numPixels; n += 1, offset += 4) {
                value = data[n];
                r = ((value >> 12) & 15);
                g = ((value >> 8) & 15);
                b = ((value >> 4) & 15);
                a = ((value) & 15);
                rgbaData[offset] = ((r << 4) | r);
                rgbaData[offset + 1] = ((g << 4) | g);
                rgbaData[offset + 2] = ((b << 4) | b);
                rgbaData[offset + 3] = ((a << 4) | a);
            }
            /* tslint:enable:no-bitwise */
        }
        return rgbaData;
    };

    TZWebGLTexture.prototype.updateData = function (data) {
        var gd = this._gd;
        var gl = gd._gl;

        function log2(a) {
            return Math.floor(Math.log(a) / Math.LN2);
        }

        var numLevels, generateMipMaps;
        if (this.mipmaps) {
            if (data instanceof Image) {
                numLevels = 1;
                generateMipMaps = true;
            } else {
                numLevels = (1 + Math.max(log2(this.width), log2(this.height)));
                generateMipMaps = false;
            }
        } else {
            numLevels = 1;
            generateMipMaps = false;
        }

        var format = this.format;
        var internalFormat, gltype, srcStep, bufferData = null;
        var compressedTexturesExtension;

        if (format === gd.PIXELFORMAT_A8) {
            internalFormat = gl.ALPHA;
            gltype = gl.UNSIGNED_BYTE;
            srcStep = 1;
            if (data && !data.src) {
                if (data instanceof Uint8Array) {
                    bufferData = data;
                } else {
                    bufferData = new Uint8Array(data);
                }
            }
        } else if (format === gd.PIXELFORMAT_L8) {
            internalFormat = gl.LUMINANCE;
            gltype = gl.UNSIGNED_BYTE;
            srcStep = 1;
            if (data && !data.src) {
                if (data instanceof Uint8Array) {
                    bufferData = data;
                } else {
                    bufferData = new Uint8Array(data);
                }
            }
        } else if (format === gd.PIXELFORMAT_L8A8) {
            internalFormat = gl.LUMINANCE_ALPHA;
            gltype = gl.UNSIGNED_BYTE;
            srcStep = 2;
            if (data && !data.src) {
                if (data instanceof Uint8Array) {
                    bufferData = data;
                } else {
                    bufferData = new Uint8Array(data);
                }
            }
        } else if (format === gd.PIXELFORMAT_R5G5B5A1) {
            internalFormat = gl.RGBA;
            gltype = gl.UNSIGNED_SHORT_5_5_5_1;
            srcStep = 1;
            if (data && !data.src) {
                if (data instanceof Uint16Array) {
                    bufferData = data;
                } else {
                    bufferData = new Uint16Array(data);
                }
            }
        } else if (format === gd.PIXELFORMAT_R5G6B5) {
            internalFormat = gl.RGB;
            gltype = gl.UNSIGNED_SHORT_5_6_5;
            srcStep = 1;
            if (data && !data.src) {
                if (data instanceof Uint16Array) {
                    bufferData = data;
                } else {
                    bufferData = new Uint16Array(data);
                }
            }
        } else if (format === gd.PIXELFORMAT_R4G4B4A4) {
            internalFormat = gl.RGBA;
            gltype = gl.UNSIGNED_SHORT_4_4_4_4;
            srcStep = 1;
            if (data && !data.src) {
                if (data instanceof Uint16Array) {
                    bufferData = data;
                } else {
                    bufferData = new Uint16Array(data);
                }
            }
        } else if (format === gd.PIXELFORMAT_R8G8B8A8) {
            internalFormat = gl.RGBA;
            gltype = gl.UNSIGNED_BYTE;
            srcStep = 4;
            if (data && !data.src) {
                if (data instanceof Uint8Array) {
                    // Some browsers consider Uint8ClampedArray to be
                    // an instance of Uint8Array (which is correct as
                    // per the spec), yet won't accept a
                    // Uint8ClampedArray as pixel data for a
                    // gl.UNSIGNED_BYTE Texture.  If we have a
                    // Uint8ClampedArray then we can just reuse the
                    // underlying data.
                    if (typeof Uint8ClampedArray !== "undefined" && data instanceof Uint8ClampedArray) {
                        bufferData = new Uint8Array(data.buffer);
                    } else {
                        bufferData = data;
                    }
                } else {
                    bufferData = new Uint8Array(data);
                }
            }
        } else if (format === gd.PIXELFORMAT_R8G8B8) {
            internalFormat = gl.RGB;
            gltype = gl.UNSIGNED_BYTE;
            srcStep = 3;
            if (data && !data.src) {
                if (data instanceof Uint8Array) {
                    // See comment above about Uint8ClampedArray
                    if (typeof Uint8ClampedArray !== "undefined" && data instanceof Uint8ClampedArray) {
                        bufferData = new Uint8Array(data.buffer);
                    } else {
                        bufferData = data;
                    }
                } else {
                    bufferData = new Uint8Array(data);
                }
            }
        } else if (format === gd.PIXELFORMAT_D32) {
            internalFormat = gl.DEPTH_COMPONENT;
            gltype = gl.UNSIGNED_INT;
        } else if (format === gd.PIXELFORMAT_D16) {
            internalFormat = gl.DEPTH_COMPONENT;
            gltype = gl.UNSIGNED_SHORT;
        } else if (format === gd.PIXELFORMAT_D24S8) {
            //internalFormat = gl.DEPTH24_STENCIL8_EXT;
            //gltype = gl.UNSIGNED_INT_24_8_EXT;
            //internalFormat = gl.DEPTH_COMPONENT;
            internalFormat = gl.DEPTH_STENCIL;
            gltype = gl.UNSIGNED_INT;
            srcStep = 1;
            if (data && !data.src) {
                bufferData = new Uint32Array(data);
            }
        } else if (format === gd.PIXELFORMAT_DXT1 || format === gd.PIXELFORMAT_DXT3 || format === gd.PIXELFORMAT_DXT5) {
            compressedTexturesExtension = gd._compressedTexturesExtension;
            if (compressedTexturesExtension) {
                if (format === gd.PIXELFORMAT_DXT1) {
                    internalFormat = compressedTexturesExtension.COMPRESSED_RGBA_S3TC_DXT1_EXT;
                    srcStep = 8;
                } else if (format === gd.PIXELFORMAT_DXT3) {
                    internalFormat = compressedTexturesExtension.COMPRESSED_RGBA_S3TC_DXT3_EXT;
                    srcStep = 16;
                } else {
                    internalFormat = compressedTexturesExtension.COMPRESSED_RGBA_S3TC_DXT5_EXT;
                    srcStep = 16;
                }

                if (internalFormat === undefined) {
                    return;
                }

                if (data && !data.src) {
                    if (data instanceof Uint8Array) {
                        bufferData = data;
                    } else {
                        bufferData = new Uint8Array(data);
                    }
                }
            } else {
                return;
            }
        } else if (format === gd.PIXELFORMAT_RGBA32F) {
            if (gd._floatTextureExtension) {
                internalFormat = gl.RGBA;
                gltype = gl.FLOAT;
                srcStep = 4;
                if (data && !data.src) {
                    if (data instanceof Float32Array) {
                        bufferData = data;
                    } else {
                        bufferData = new Float32Array(data);
                    }
                }
            } else {
                return;
            }
        } else if (format === gd.PIXELFORMAT_RGB32F) {
            if (gd._floatTextureExtension) {
                internalFormat = gl.RGB;
                gltype = gl.FLOAT;
                srcStep = 3;
                if (data && !data.src) {
                    if (data instanceof Float32Array) {
                        bufferData = data;
                    } else {
                        bufferData = new Float32Array(data);
                    }
                }
            } else {
                return;
            }
        } else if (format === gd.PIXELFORMAT_RGBA16F) {
            if (gd._halfFloatTextureExtension) {
                internalFormat = gl.RGBA;
                gltype = gd._halfFloatTextureExtension.HALF_FLOAT_OES;
                srcStep = 4;
                if (data && !data.src) {
                    bufferData = data;
                }
            } else {
                return;
            }
        } else if (format === gd.PIXELFORMAT_RGB16F) {
            if (gd._halfFloatTextureExtension) {
                internalFormat = gl.RGB;
                gltype = gd._halfFloatTextureExtension.HALF_FLOAT_OES;
                srcStep = 3;
                if (data && !data.src) {
                    bufferData = data;
                }
            } else {
                return;
            }
        } else {
            return;
        }

        if (gd._fixIE && !compressedTexturesExtension) {
            var expand = false;
            if (gd._fixIE < "0.93") {
                expand = ((internalFormat !== gl.RGBA && internalFormat !== gl.RGB) || (gltype !== gl.UNSIGNED_BYTE && gltype !== gl.FLOAT));
            } else if (gd._fixIE < "0.94") {
                expand = (gltype !== gl.UNSIGNED_BYTE && gltype !== gl.FLOAT);
            }
            if (expand) {
                if (bufferData) {
                    bufferData = this.convertDataToRGBA(gl, bufferData, internalFormat, gltype, srcStep);
                }
                internalFormat = gl.RGBA;
                gltype = gl.UNSIGNED_BYTE;
                srcStep = 4;
            }
        }

        var w = this.width, h = this.height, offset = 0, target, n, levelSize, levelData;
        if (this.cubemap) {
            if (data && data instanceof WebGLVideo) {
                return;
            }

            target = gl.TEXTURE_CUBE_MAP;

            for (var f = 0; f < 6; f += 1) {
                var faceTarget = (gl.TEXTURE_CUBE_MAP_POSITIVE_X + f);
                for (n = 0; n < numLevels; n += 1) {
                    if (compressedTexturesExtension) {
                        levelSize = (Math.floor((w + 3) / 4) * Math.floor((h + 3) / 4) * srcStep);
                        if (bufferData) {
                            levelData = bufferData.subarray(offset, (offset + levelSize));
                        } else {
                            levelData = new Uint8Array(levelSize);
                        }
                        if (gd._WEBGL_compressed_texture_s3tc) {
                            gl.compressedTexImage2D(faceTarget, n, internalFormat, w, h, 0, levelData);
                        } else {
                            compressedTexturesExtension.compressedTexImage2D(faceTarget, n, internalFormat, w, h, 0, levelData);
                        }
                    } else {
                        levelSize = (w * h * srcStep);
                        if (bufferData) {
                            levelData = bufferData.subarray(offset, (offset + levelSize));
                            gl.texImage2D(faceTarget, n, internalFormat, w, h, 0, internalFormat, gltype, levelData);
                        } else if (data) {
                            gl.texImage2D(faceTarget, n, internalFormat, internalFormat, gltype, data);
                        } else {
                            if (gltype === gl.UNSIGNED_SHORT_5_6_5 || gltype === gl.UNSIGNED_SHORT_5_5_5_1 || gltype === gl.UNSIGNED_SHORT_4_4_4_4) {
                                levelData = new Uint16Array(levelSize);
                            } else if (gltype === gl.FLOAT) {
                                levelData = new Float32Array(levelSize);
                            } else if (gd._halfFloatTextureExtension && gltype === gd._halfFloatTextureExtension.HALF_FLOAT_OES) {
                                levelData = null;
                            } else {
                                levelData = new Uint8Array(levelSize);
                            }
                            gl.texImage2D(faceTarget, n, internalFormat, w, h, 0, internalFormat, gltype, levelData);
                        }
                    }
                    offset += levelSize;
                    if (bufferData && bufferData.length <= offset) {
                        bufferData = null;
                        data = null;
                        if (0 === n && 1 < numLevels) {
                            generateMipMaps = true;
                            break;
                        }
                    }
                    w = (w > 1 ? Math.floor(w / 2) : 1);
                    h = (h > 1 ? Math.floor(h / 2) : 1);
                }
                w = this.width;
                h = this.height;
            }
        } else if (data && data instanceof WebGLVideo) {
            target = gl.TEXTURE_2D;
            gl.texImage2D(target, 0, internalFormat, internalFormat, gltype, data.video);
        } else {
            target = gl.TEXTURE_2D;

            for (n = 0; n < numLevels; n += 1) {
                if (compressedTexturesExtension) {
                    levelSize = (Math.floor((w + 3) / 4) * Math.floor((h + 3) / 4) * srcStep);
                    if (bufferData) {
                        if (numLevels === 1) {
                            levelData = bufferData;
                        } else {
                            levelData = bufferData.subarray(offset, (offset + levelSize));
                        }
                    } else {
                        levelData = new Uint8Array(levelSize);
                    }
                    if (gd._WEBGL_compressed_texture_s3tc) {
                        gl.compressedTexImage2D(target, n, internalFormat, w, h, 0, levelData);
                    } else {
                        compressedTexturesExtension.compressedTexImage2D(target, n, internalFormat, w, h, 0, levelData);
                    }
                } else {
                    levelSize = (w * h * srcStep);
                    if (bufferData) {
                        if (numLevels === 1) {
                            levelData = bufferData;
                        } else {
                            levelData = bufferData.subarray(offset, (offset + levelSize));
                        }
                        gl.texImage2D(target, n, internalFormat, w, h, 0, internalFormat, gltype, levelData);
                    } else if (data) {
                        // JE: Pad up to power of two
                        if (!isPowerOfTwo(w) || !isPowerOfTwo(h)) {
                          assert(n === 0);
                          this.width = nextHighestPowerOfTwo(w);
                          this.height = nextHighestPowerOfTwo(h);
                          gl.texImage2D(target, n, internalFormat, this.width, this.height, 0, internalFormat, gltype, null);
                          // Duplicate right and bottom pixel row by sending image 3 times
                          if (w !== this.width) {
                            gl.texSubImage2D(target, n, 1, 0, internalFormat, gltype, data);
                          }
                          if (h !== this.height) {
                            gl.texSubImage2D(target, n, 0, 1, internalFormat, gltype, data);
                          }
                          gl.texSubImage2D(target, n, 0, 0, internalFormat, gltype, data);
                        } else {
                          gl.texImage2D(target, n, internalFormat, internalFormat, gltype, data);
                        }
                    } else {
                        if (gltype === gl.UNSIGNED_SHORT_5_6_5 || gltype === gl.UNSIGNED_SHORT_5_5_5_1 || gltype === gl.UNSIGNED_SHORT_4_4_4_4) {
                            levelData = new Uint16Array(levelSize);
                        } else if (gltype === gl.FLOAT) {
                            levelData = new Float32Array(levelSize);
                        } else if ((gd._halfFloatTextureExtension && gltype === gd._halfFloatTextureExtension.HALF_FLOAT_OES) || internalFormat === gl.DEPTH_COMPONENT) {
                            levelData = null;
                        } else {
                            levelData = new Uint8Array(levelSize);
                        }
                        gl.texImage2D(target, n, internalFormat, w, h, 0, internalFormat, gltype, levelData);
                    }
                }
                offset += levelSize;
                if (bufferData && bufferData.length <= offset) {
                    bufferData = null;
                    data = null;
                    if (0 === n && 1 < numLevels) {
                        generateMipMaps = true;
                        break;
                    }
                }
                w = (w > 1 ? Math.floor(w / 2) : 1);
                h = (h > 1 ? Math.floor(h / 2) : 1);
            }
        }

        if (generateMipMaps) {
            gl.generateMipmap(target);
        }
    };

    TZWebGLTexture.prototype.updateSubData = function (data, face, level, x, y, w, h) {
        debug.assert(data);
        debug.assert(face === 0 || (this.cubemap && face < 6));
        debug.assert(0 <= x && (x + w) <= this.width);
        debug.assert(0 <= y && (y + h) <= this.height);
        var gd = this._gd;
        var gl = gd._gl;

        var format = this.format;
        var glformat, gltype, bufferData;
        var compressedTexturesExtension;

        if (format === gd.PIXELFORMAT_A8) {
            glformat = gl.ALPHA;
            gltype = gl.UNSIGNED_BYTE;
            if (data instanceof Uint8Array) {
                bufferData = data;
            } else {
                bufferData = new Uint8Array(data);
            }
        } else if (format === gd.PIXELFORMAT_L8) {
            glformat = gl.LUMINANCE;
            gltype = gl.UNSIGNED_BYTE;
            if (data instanceof Uint8Array) {
                bufferData = data;
            } else {
                bufferData = new Uint8Array(data);
            }
        } else if (format === gd.PIXELFORMAT_L8A8) {
            glformat = gl.LUMINANCE_ALPHA;
            gltype = gl.UNSIGNED_BYTE;
            if (data instanceof Uint8Array) {
                bufferData = data;
            } else {
                bufferData = new Uint8Array(data);
            }
        } else if (format === gd.PIXELFORMAT_R5G5B5A1) {
            glformat = gl.RGBA;
            gltype = gl.UNSIGNED_SHORT_5_5_5_1;
            if (data instanceof Uint16Array) {
                bufferData = data;
            } else {
                bufferData = new Uint16Array(data);
            }
        } else if (format === gd.PIXELFORMAT_R5G6B5) {
            glformat = gl.RGB;
            gltype = gl.UNSIGNED_SHORT_5_6_5;
            if (data instanceof Uint16Array) {
                bufferData = data;
            } else {
                bufferData = new Uint16Array(data);
            }
        } else if (format === gd.PIXELFORMAT_R4G4B4A4) {
            glformat = gl.RGBA;
            gltype = gl.UNSIGNED_SHORT_4_4_4_4;
            if (data instanceof Uint16Array) {
                bufferData = data;
            } else {
                bufferData = new Uint16Array(data);
            }
        } else if (format === gd.PIXELFORMAT_R8G8B8A8) {
            glformat = gl.RGBA;
            gltype = gl.UNSIGNED_BYTE;
            if (data instanceof Uint8Array) {
                // See comment above about Uint8ClampedArray on updateData
                if (typeof Uint8ClampedArray !== "undefined" && data instanceof Uint8ClampedArray) {
                    bufferData = new Uint8Array(data.buffer);
                } else {
                    bufferData = data;
                }
            } else {
                bufferData = new Uint8Array(data);
            }
        } else if (format === gd.PIXELFORMAT_R8G8B8) {
            glformat = gl.RGB;
            gltype = gl.UNSIGNED_BYTE;
            if (data instanceof Uint8Array) {
                // See comment above about Uint8ClampedArray on updateData
                if (typeof Uint8ClampedArray !== "undefined" && data instanceof Uint8ClampedArray) {
                    bufferData = new Uint8Array(data.buffer);
                } else {
                    bufferData = data;
                }
            } else {
                bufferData = new Uint8Array(data);
            }
        } else if (format === gd.PIXELFORMAT_DXT1 || format === gd.PIXELFORMAT_DXT3 || format === gd.PIXELFORMAT_DXT5) {
            compressedTexturesExtension = gd._compressedTexturesExtension;
            if (compressedTexturesExtension) {
                if (format === gd.PIXELFORMAT_DXT1) {
                    glformat = compressedTexturesExtension.COMPRESSED_RGBA_S3TC_DXT1_EXT;
                } else if (format === gd.PIXELFORMAT_DXT3) {
                    glformat = compressedTexturesExtension.COMPRESSED_RGBA_S3TC_DXT3_EXT;
                } else {
                    glformat = compressedTexturesExtension.COMPRESSED_RGBA_S3TC_DXT5_EXT;
                }

                if (data instanceof Uint8Array) {
                    bufferData = data;
                } else {
                    bufferData = new Uint8Array(data);
                }
            } else {
                return;
            }
        } else if (format === gd.PIXELFORMAT_RGBA32F) {
            if (gd._floatTextureExtension) {
                glformat = gl.RGBA;
                gltype = gl.FLOAT;
                if (data instanceof Float32Array) {
                    bufferData = data;
                } else {
                    bufferData = new Float32Array(data);
                }
            } else {
                return;
            }
        } else if (format === gd.PIXELFORMAT_RGB32F) {
            if (gd._floatTextureExtension) {
                glformat = gl.RGB;
                gltype = gl.FLOAT;
                if (data instanceof Float32Array) {
                    bufferData = data;
                } else {
                    bufferData = new Float32Array(data);
                }
            } else {
                return;
            }
        } else if (format === gd.PIXELFORMAT_RGBA16F) {
            if (gd._halfFloatTextureExtension) {
                glformat = gl.RGBA;
                gltype = gd._halfFloatTextureExtension.HALF_FLOAT_OES;
                bufferData = data;
            } else {
                return;
            }
        } else if (format === gd.PIXELFORMAT_RGB16F) {
            if (gd._halfFloatTextureExtension) {
                glformat = gl.RGB;
                gltype = gd._halfFloatTextureExtension.HALF_FLOAT_OES;
                bufferData = data;
            } else {
                return;
            }
        } else {
            return;
        }

        var target;
        if (this.cubemap) {
            if (data instanceof WebGLVideo) {
                return;
            }

            target = (gl.TEXTURE_CUBE_MAP_POSITIVE_X + face);
        } else if (data instanceof WebGLVideo) {
            target = gl.TEXTURE_2D;

            // width and height are taken from video
            gl.texSubImage2D(target, level, x, y, glformat, gltype, data.video);
            return;
        } else {
            target = gl.TEXTURE_2D;
        }

        if (compressedTexturesExtension) {
            if (gd._WEBGL_compressed_texture_s3tc) {
                gl.compressedTexSubImage2D(target, level, x, y, w, h, glformat, bufferData);
            } else {
                compressedTexturesExtension.compressedTexSubImage2D(target, level, x, y, w, h, glformat, bufferData);
            }
        } else {
            gl.texSubImage2D(target, level, x, y, w, h, glformat, gltype, bufferData);
        }
    };

    TZWebGLTexture.prototype.updateMipmaps = function (face) {
        if (this.mipmaps) {
            if (this.depth > 1) {
                TurbulenzEngine.callOnError("3D texture mipmap generation unsupported");
                return;
            }

            if (this.cubemap && face !== 5) {
                return;
            }

            var gd = this._gd;
            var gl = gd._gl;

            var target = this._target;
            gd._temporaryBindTexture(target, this._glTexture);
            gl.generateMipmap(target);
            gd._temporaryBindTexture(target, null);
        }
    };

    TZWebGLTexture.prototype.destroy = function () {
        var gd = this._gd;
        if (gd) {
            var glTexture = this._glTexture;
            if (glTexture) {
                var gl = gd._gl;
                if (gl) {
                    gd.unbindTexture(glTexture);
                    gl.deleteTexture(glTexture);
                }
                delete this._glTexture;
            }

            delete this._sampler;
            delete this._gd;
        }
    };

    TZWebGLTexture.prototype.typedArrayIsValid = function (typedArray) {
        var gd = this._gd;
        var format = this.format;

        if (gd) {
            if ((format === gd.PIXELFORMAT_A8) || (format === gd.PIXELFORMAT_L8) || (format === gd.PIXELFORMAT_S8)) {
                return ((typedArray instanceof Uint8Array) || (typeof Uint8ClampedArray !== "undefined" && typedArray instanceof Uint8ClampedArray)) && (typedArray.length === this.width * this.height * this.depth);
            }
            if (format === gd.PIXELFORMAT_L8A8) {
                return ((typedArray instanceof Uint8Array) || (typeof Uint8ClampedArray !== "undefined" && typedArray instanceof Uint8ClampedArray)) && (typedArray.length === 2 * this.width * this.height * this.depth);
            }
            if (format === gd.PIXELFORMAT_R8G8B8) {
                return ((typedArray instanceof Uint8Array) || (typeof Uint8ClampedArray !== "undefined" && typedArray instanceof Uint8ClampedArray)) && (typedArray.length === 3 * this.width * this.height * this.depth);
            }
            if (format === gd.PIXELFORMAT_R8G8B8A8) {
                return ((typedArray instanceof Uint8Array) || (typeof Uint8ClampedArray !== "undefined" && typedArray instanceof Uint8ClampedArray)) && (typedArray.length === 4 * this.width * this.height * this.depth);
            }
            if ((format === gd.PIXELFORMAT_R5G5B5A1) || (format === gd.PIXELFORMAT_R5G6B5) || (format === gd.PIXELFORMAT_R4G4B4A4)) {
                return (typedArray instanceof Uint16Array) && (typedArray.length === this.width * this.height * this.depth);
            }
            if (format === gd.PIXELFORMAT_RGBA32F) {
                return (typedArray instanceof Float32Array) && (typedArray.length === 4 * this.width * this.height * this.depth);
            }
            if (format === gd.PIXELFORMAT_RGB32F) {
                return (typedArray instanceof Float32Array) && (typedArray.length === 3 * this.width * this.height * this.depth);
            }
            if (format === gd.PIXELFORMAT_RGBA16F) {
                return (typedArray instanceof Uint16Array) && (typedArray.length === 4 * this.width * this.height * this.depth);
            }
            if (format === gd.PIXELFORMAT_RGB16F) {
                return (typedArray instanceof Uint16Array) && (typedArray.length === 3 * this.width * this.height * this.depth);
            }
        }
        return false;
    };

    TZWebGLTexture.create = function (gd, params) {
        var tex = new TZWebGLTexture();
        tex._gd = gd;
        tex.mipmaps = params.mipmaps;
        tex.dynamic = params.dynamic;
        tex.renderable = (params.renderable || false);
        tex.id = ++gd._counters.textures;

        var src = params.src;
        if (src) {
            tex.name = params.name || src;
            var extension;
            var data = params.data;
            if (data) {
                // do not trust file extensions if we got data...
                if (data[0] === 137 && data[1] === 80 && data[2] === 78 && data[3] === 71) {
                    extension = '.png';
                } else if (data[0] === 255 && data[1] === 216 && data[2] === 255 && (data[3] === 224 || data[3] === 225)) {
                    extension = '.jpg';
                } else if (data[0] === 68 && data[1] === 68 && data[2] === 83 && data[3] === 32) {
                    extension = '.dds';
                } else {
                    extension = src.slice(-4);
                }
            } else {
                extension = src.slice(-4);
            }

            // DDS and TGA textures require out own image loaders
            if (extension === '.dds' || extension === '.tga') {
                if (extension === '.tga' && typeof TGALoader !== 'undefined') {
                    var tgaParams = {
                        gd: gd,
                        onload: function tgaLoadedFn(data, width, height, format, status) {
                            tex.width = width;
                            tex.height = height;
                            tex.depth = 1;
                            tex.format = format;
                            tex.cubemap = false;
                            var result = tex.createGLTexture(data);
                            if (params.onload) {
                                params.onload(result ? tex : null, status);
                            }
                        },
                        onerror: function tgaFailedFn(status) {
                            tex._failed = true;
                            if (params.onload) {
                                params.onload(null, status);
                            }
                        },
                        data: undefined,
                        src: undefined
                    };
                    if (data) {
                        tgaParams.data = data;
                    } else {
                        tgaParams.src = src;
                    }
                    TGALoader.create(tgaParams);
                    return tex;
                } else if (extension === '.dds' && typeof DDSLoader !== 'undefined') {
                    var ddsParams = {
                        gd: gd,
                        onload: function ddsLoadedFn(data, width, height, format, numLevels, cubemap, depth, status) {
                            tex.width = width;
                            tex.height = height;
                            tex.format = format;
                            tex.cubemap = cubemap;
                            tex.depth = depth;
                            if (1 < numLevels) {
                                if (!tex.mipmaps) {
                                    tex.mipmaps = true;
                                    debug.log("Mipmap levels provided for texture created without mipmaps enabled: " + tex.name);
                                }
                            }
                            var result = tex.createGLTexture(data);
                            if (params.onload) {
                                params.onload(result ? tex : null, status);
                            }
                        },
                        onerror: function ddsFailedFn(status) {
                            tex._failed = true;
                            if (params.onload) {
                                params.onload(null, status);
                            }
                        },
                        data: undefined,
                        src: undefined
                    };
                    if (data) {
                        ddsParams.data = data;
                    } else {
                        ddsParams.src = src;
                    }
                    DDSLoader.create(ddsParams);
                    return tex;
                } else {
                    TurbulenzEngine.callOnError('Missing image loader required for ' + src);

                    tex = TZWebGLTexture.create(gd, {
                        name: (params.name || src),
                        width: 2,
                        height: 2,
                        depth: 1,
                        format: 'R8G8B8A8',
                        cubemap: false,
                        mipmaps: params.mipmaps,
                        dynamic: params.dynamic,
                        renderable: params.renderable,
                        data: [
                            255, 20, 147, 255,
                            255, 0, 0, 255,
                            255, 255, 255, 255,
                            255, 20, 147, 255]
                    });

                    if (params.onload) {
                        if (TurbulenzEngine) {
                            TurbulenzEngine.setTimeout(function () {
                                params.onload(tex, 200);
                            }, 0);
                        } else {
                            window.setTimeout(function () {
                                params.onload(tex, 200);
                            }, 0);
                        }
                    }
                    return tex;
                }
            }

            var img = new Image();
            var imageLoaded = function imageLoadedFn() {
                tex.width = img.width;
                tex.height = img.height;
                tex.depth = 1;
                tex.format = gd.PIXELFORMAT_R8G8B8A8;
                tex.cubemap = false;
                var result = tex.createGLTexture(img);
                if (params.onload) {
                    params.onload(result ? tex : null, 200);
                }
            };
            img.onload = imageLoaded;
            img.onerror = function imageFailedFn() {
                tex._failed = true;
                if (params.onload) {
                    params.onload(null);
                }
            };
            if (data) {
                if (typeof Blob !== "undefined" && typeof URL !== "undefined" && URL.createObjectURL) {
                    var dataBlob;
                    if (extension === '.jpg' || extension === '.jpeg') {
                        dataBlob = new Blob([data], { type: "image/jpeg" });
                    } else if (extension === '.png') {
                        dataBlob = new Blob([data], { type: "image/png" });
                    }
                    debug.assert(data.length === dataBlob.size, "Blob constructor does not support typed arrays.");
                    img.onload = function blobImageLoadedFn() {
                        imageLoaded();
                        URL.revokeObjectURL(img.src);
                        dataBlob = null;
                    };
                    src = URL.createObjectURL(dataBlob);
                } else {
                    if (extension === '.jpg' || extension === '.jpeg') {
                        src = 'data:image/jpeg;base64,' + TurbulenzEngine.base64Encode(data);
                    } else if (extension === '.png') {
                        src = 'data:image/png;base64,' + TurbulenzEngine.base64Encode(data);
                    }
                }
                img.src = src;
            } else if (typeof URL !== "undefined" && URL.createObjectURL) {
                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (!TurbulenzEngine || !TurbulenzEngine.isUnloading()) {
                            var xhrStatus = xhr.status;

                            // Fix for loading from file
                            if (xhrStatus === 0 && (window.location.protocol === "file:" || window.location.protocol === "chrome-extension:")) {
                                xhrStatus = 200;
                            }

                            // Sometimes the browser sets status to 200 OK when the connection is closed
                            // before the message is sent (weird!).
                            // In order to address this we fail any completely empty responses.
                            // Hopefully, nobody will get a valid response with no headers and no body!
                            if (xhr.getAllResponseHeaders() === "" && !xhr.response) {
                                if (params.onload) {
                                    params.onload(null, 0);
                                }
                            } else {
                                if (xhrStatus === 200 || xhrStatus === 0) {
                                    var blob = xhr.response;
                                    img.onload = function blobImageLoadedFn() {
                                        imageLoaded();
                                        URL.revokeObjectURL(img.src);
                                        blob = null;
                                    };
                                    img.src = URL.createObjectURL(blob);
                                } else {
                                    params.onload(null, xhrStatus);
                                }
                            }
                            xhr.onreadystatechange = null;
                            xhr = null;
                        }
                        return tex;
                    }
                };
                xhr.open('GET', src, true);
                xhr.responseType = 'blob';
                xhr.send();
            } else {
                img.crossOrigin = 'anonymous';
                img.src = src;
            }
        } else {
            // Invalid src values like "" fall through to here
            if ("" === src && params.onload) {
                // Assume the caller intended to pass in a valid url.
                return null;
            }

            var format = params.format;
            if (typeof format === 'string') {
                format = gd['PIXELFORMAT_' + format];
            }

            tex.width = params.width;
            tex.height = params.height;
            tex.depth = params.depth;
            tex.format = format;
            tex.cubemap = (params.cubemap || false);
            tex.name = params.name;

            if (tex.width === 0 || tex.height === 0) {
                debug.assert(false, "Invalid texture dimensions.");
                return null;
            }

            var result = tex.createGLTexture(params.data, params.no_data);
            if (!result) {
                tex = null;
            }

            // If this is a depth-texture, note the attachment type
            // required, based on the format.
            if (params.renderable) {
                if (gd.PIXELFORMAT_D16 === format || gd.PIXELFORMAT_D32 === format) {
                    tex._glDepthAttachment = gd._gl.DEPTH_ATTACHMENT;
                } else if (gd.PIXELFORMAT_D24S8 === format) {
                    tex._glDepthAttachment = gd._gl.DEPTH_STENCIL_ATTACHMENT;
                }
            }

            if (params.onload) {
                params.onload(tex, 200);
            }
        }

        return tex;
    };
    TZWebGLTexture.version = 1;
    return TZWebGLTexture;
})();

//
// WebGLVideo
//
var WebGLVideo = (function () {
    function WebGLVideo() {
    }
    // Public API
    WebGLVideo.prototype.play = function (seek) {
        var video = this.video;

        if (!this.playing) {
            this.playing = true;
            this.paused = false;
        }

        if (seek === undefined) {
            seek = 0;
        }

        if (0.01 < Math.abs(video.currentTime - seek)) {
            try  {
                video.currentTime = seek;
            } catch (e) {
                // There does not seem to be any reliable way of seeking
            }
        }

        video.play();

        return true;
    };

    WebGLVideo.prototype.stop = function () {
        var playing = this.playing;
        if (playing) {
            this.playing = false;
            this.paused = false;

            var video = this.video;
            video.pause();
            video.currentTime = 0;
        }

        return playing;
    };

    WebGLVideo.prototype.pause = function () {
        if (this.playing) {
            if (!this.paused) {
                this.paused = true;

                this.video.pause();
            }

            return true;
        }

        return false;
    };

    WebGLVideo.prototype.resume = function (seek) {
        if (this.paused) {
            this.paused = false;

            var video = this.video;

            if (seek !== undefined) {
                if (0.01 < Math.abs(video.currentTime - seek)) {
                    try  {
                        video.currentTime = seek;
                    } catch (e) {
                        // There does not seem to be any reliable way of seeking
                    }
                }
            }

            video.play();

            return true;
        }

        return false;
    };

    WebGLVideo.prototype.rewind = function () {
        if (this.playing) {
            this.video.currentTime = 0;

            return true;
        }

        return false;
    };

    WebGLVideo.prototype.destroy = function () {
        this.stop();

        if (this.video) {
            if (this.elementAdded) {
                this.elementAdded = false;
                TurbulenzEngine.canvas.parentElement.removeChild(this.video);
            }
            this.video = null;
        }
    };

    WebGLVideo.create = function (params) {
        var v = new WebGLVideo();

        var onload = params.onload;
        var looping = params.looping;
        var src = params.src;

        var userAgent = navigator.userAgent.toLowerCase();

        var video = (document.createElement('video'));
        video.preload = 'auto';
        video.autobuffer = true;
        video.muted = true;
        if (looping) {
            if (video.loop !== undefined && !userAgent.match(/firefox/)) {
                video.loop = true;
            } else {
                video.onended = function () {
                    video.src = src;
                    video.play();
                };
            }
        } else {
            video.onended = function () {
                v.playing = false;
            };
        }

        v.video = video;
        v.src = src;
        v.playing = false;
        v.paused = false;

        // Safari does not play the video unless is on the page...
        if (userAgent.match(/safari/) && !userAgent.match(/chrome/)) {
            //video.setAttribute("style", "display: none;");
            video.setAttribute("style", "visibility: hidden;");
            TurbulenzEngine.canvas.parentElement.appendChild(video);
            v.elementAdded = true;
        }

        if (video.webkitDecodedFrameCount !== undefined) {
            var lastFrameCount = -1, tell = 0;
            Object.defineProperty(v, "tell", {
                get: function tellFn() {
                    if (lastFrameCount !== this.video.webkitDecodedFrameCount) {
                        lastFrameCount = this.video.webkitDecodedFrameCount;
                        tell = this.video.currentTime;
                    }
                    return tell;
                },
                enumerable: true,
                configurable: false
            });
        } else {
            Object.defineProperty(v, "tell", {
                get: function tellFn() {
                    return this.video.currentTime;
                },
                enumerable: true,
                configurable: false
            });
        }

        Object.defineProperty(v, "looping", {
            get: function loopingFn() {
                return looping;
            },
            enumerable: true,
            configurable: false
        });

        var loadingVideoFailed = function loadingVideoFailedFn() {
            if (onload) {
                onload(null, undefined);
                onload = null;
            }
            video.removeEventListener("error", loadingVideoFailed);
            video = null;
            v.video = null;
            v.playing = false;
        };
        video.addEventListener("error", loadingVideoFailed, false);

        var videoCanPlay = function videoCanPlayFn() {
            v.length = video.duration;
            v.width = video.videoWidth;
            v.height = video.videoHeight;

            if (onload) {
                onload(v, 200);
                onload = null;
            }

            video.removeEventListener("progress", checkProgress);
            video.removeEventListener("canplaythrough", videoCanPlay);
        };
        var checkProgress = function checkProgressFn() {
            if (0 < video.buffered.length && video.buffered.end(0) >= video.duration) {
                videoCanPlay();
            }
        };
        video.addEventListener("progress", checkProgress, false);
        video.addEventListener("canplaythrough", videoCanPlay, false);

        video.crossorigin = 'anonymous';
        video.src = src;

        return v;
    };
    WebGLVideo.version = 1;
    return WebGLVideo;
})();

//
// WebGLRenderBuffer
//
var WebGLRenderBuffer = (function () {
    function WebGLRenderBuffer() {
    }
    WebGLRenderBuffer.prototype.destroy = function () {
        var gd = this._gd;
        if (gd) {
            var glBuffer = this._glBuffer;
            if (glBuffer) {
                var gl = gd._gl;
                if (gl) {
                    gl.deleteRenderbuffer(glBuffer);
                }
                delete this._glBuffer;
            }

            delete this._gd;
        }
    };

    WebGLRenderBuffer.create = function (gd, params) {
        var renderBuffer = new WebGLRenderBuffer();

        var width = params.width;
        var height = params.height;
        var format = params.format;
        if (typeof format === 'string') {
            format = gd['PIXELFORMAT_' + format];
        }

        if (format !== gd.PIXELFORMAT_D24S8 && format !== gd.PIXELFORMAT_D16 && format !== gd.PIXELFORMAT_D32) {
            return null;
        }

        var gl = gd._gl;

        var glBuffer = gl.createRenderbuffer();

        gl.bindRenderbuffer(gl.RENDERBUFFER, glBuffer);

        var internalFormat;
        var attachment;
        if (gd.PIXELFORMAT_D16 === format) {
            internalFormat = gl.DEPTH_COMPONENT16;
            attachment = gl.DEPTH_ATTACHMENT;
        } else if (gd.PIXELFORMAT_D32 === format) {
            internalFormat = gl.DEPTH_COMPONENT;
            attachment = gl.DEPTH_ATTACHMENT;
        } else {
            internalFormat = gl.DEPTH_STENCIL;
            attachment = gl.DEPTH_STENCIL_ATTACHMENT;
        }

        // else if (gd.PIXELFORMAT_S8 === format)
        // {
        //     internalFormat = gl.STENCIL_INDEX8;
        //     attachment = gl.STENCIL_ATTACHMENT;
        // }
        gl.renderbufferStorage(gl.RENDERBUFFER, internalFormat, width, height);
        renderBuffer.width = gl.getRenderbufferParameter(gl.RENDERBUFFER, gl.RENDERBUFFER_WIDTH);
        renderBuffer.height = gl.getRenderbufferParameter(gl.RENDERBUFFER, gl.RENDERBUFFER_HEIGHT);

        gl.bindRenderbuffer(gl.RENDERBUFFER, null);

        if (renderBuffer.width < width || renderBuffer.height < height) {
            gl.deleteRenderbuffer(glBuffer);
            return null;
        }

        renderBuffer._gd = gd;
        renderBuffer.format = format;
        renderBuffer._glDepthAttachment = attachment;
        renderBuffer._glBuffer = glBuffer;
        renderBuffer.id = ++gd._counters.renderBuffers;

        return renderBuffer;
    };
    WebGLRenderBuffer.version = 1;
    return WebGLRenderBuffer;
})();

//
// WebGLRenderTarget
//
var WebGLRenderTarget = (function () {
    function WebGLRenderTarget() {
    }
    WebGLRenderTarget.prototype.copyBox = function (dst, src) {
        dst[0] = src[0];
        dst[1] = src[1];
        dst[2] = src[2];
        dst[3] = src[3];
    };

    WebGLRenderTarget.prototype.bind = function () {
        var gd = this._gd;
        var gl = gd._gl;

        if (this.colorTexture0) {
            gd.unbindTexture(this.colorTexture0._glTexture);
            if (this.colorTexture1) {
                gd.unbindTexture(this.colorTexture1._glTexture);
                if (this.colorTexture2) {
                    gd.unbindTexture(this.colorTexture2._glTexture);
                    if (this.colorTexture3) {
                        gd.unbindTexture(this.colorTexture3._glTexture);
                    }
                }
            }
        }
        if (this.depthTexture) {
            gd.unbindTexture(this.depthTexture._glTexture);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, this._glObject);

        // Only call drawBuffers if we have more than one color attachment
        if (this.colorTexture1) {
            var drawBuffersExtension = gd._drawBuffersExtension;
            if (drawBuffersExtension) {
                if (gd._WEBGL_draw_buffers) {
                    drawBuffersExtension.drawBuffersWEBGL(this._buffers);
                } else {
                    drawBuffersExtension.drawBuffersEXT(this._buffers);
                }
            }
        }

        var state = gd._state;
        this.copyBox(this._oldViewportBox, state.viewportBox);
        this.copyBox(this._oldScissorBox, state.scissorBox);
        gd.setViewport(0, 0, this.width, this.height);
        gd.setScissor(0, 0, this.width, this.height);

        return true;
    };

    WebGLRenderTarget.prototype.unbind = function () {
        var gd = this._gd;
        var gl = gd._gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Only call drawBuffers if we have more than one color attachment
        if (this.colorTexture1) {
            var drawBuffersExtension = gd._drawBuffersExtension;
            if (drawBuffersExtension) {
                var buffers = [gl.BACK];

                if (gd._WEBGL_draw_buffers) {
                    drawBuffersExtension.drawBuffersWEBGL(buffers);
                } else {
                    drawBuffersExtension.drawBuffersEXT(buffers);
                }
            }
        }

        var box = this._oldViewportBox;
        gd.setViewport(box[0], box[1], box[2], box[3]);
        box = this._oldScissorBox;
        gd.setScissor(box[0], box[1], box[2], box[3]);

        if (this.colorTexture0) {
            this.colorTexture0.updateMipmaps(this.face);
            if (this.colorTexture1) {
                this.colorTexture1.updateMipmaps(this.face);
                if (this.colorTexture2) {
                    this.colorTexture2.updateMipmaps(this.face);
                    if (this.colorTexture3) {
                        this.colorTexture3.updateMipmaps(this.face);
                    }
                }
            }
        }
        if (this.depthTexture) {
            this.depthTexture.updateMipmaps(this.face);
        }
    };

    WebGLRenderTarget.prototype._updateColorAttachement = function (colorTexture, index) {
        var glTexture = colorTexture._glTexture;
        var gl = this._gd._gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._glObject);
        if (colorTexture.cubemap) {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, (gl.COLOR_ATTACHMENT0 + index), (gl.TEXTURE_CUBE_MAP_POSITIVE_X + this.face), glTexture, 0);
        } else {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, (gl.COLOR_ATTACHMENT0 + index), gl.TEXTURE_2D, glTexture, 0);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    WebGLRenderTarget.prototype.getWidth = function () {
        if (this.colorTexture0) {
            return this.colorTexture0.width;
        } else if (this.depthBuffer) {
            return this.depthBuffer.width;
        } else if (this.depthTexture) {
            return this.depthTexture.width;
        }
    };

    WebGLRenderTarget.prototype.getHeight = function () {
        if (this.colorTexture0) {
            return this.colorTexture0.height;
        } else if (this.depthBuffer) {
            return this.depthBuffer.height;
        } else if (this.depthTexture) {
            return this.depthTexture.height;
        }
    };

    WebGLRenderTarget.prototype.setColorTexture0 = function (colorTexture0) {
        var oldColorTexture0 = this.colorTexture0;
        debug.assert(oldColorTexture0 && colorTexture0 && oldColorTexture0.width === colorTexture0.width && oldColorTexture0.height === colorTexture0.height && oldColorTexture0.format === colorTexture0.format && oldColorTexture0.cubemap === colorTexture0.cubemap);
        this.colorTexture0 = (colorTexture0);
        this._updateColorAttachement(this.colorTexture0, 0);
    };

    WebGLRenderTarget.prototype.setColorTexture1 = function (colorTexture1) {
        var oldColorTexture1 = this.colorTexture1;
        debug.assert(oldColorTexture1 && colorTexture1 && oldColorTexture1.width === colorTexture1.width && oldColorTexture1.height === colorTexture1.height && oldColorTexture1.format === colorTexture1.format && oldColorTexture1.cubemap === colorTexture1.cubemap);
        this.colorTexture1 = (colorTexture1);
        this._updateColorAttachement(this.colorTexture1, 1);
    };

    WebGLRenderTarget.prototype.setColorTexture2 = function (colorTexture2) {
        var oldColorTexture2 = this.colorTexture2;
        debug.assert(oldColorTexture2 && colorTexture2 && oldColorTexture2.width === colorTexture2.width && oldColorTexture2.height === colorTexture2.height && oldColorTexture2.format === colorTexture2.format && oldColorTexture2.cubemap === colorTexture2.cubemap);
        this.colorTexture2 = (colorTexture2);
        this._updateColorAttachement(this.colorTexture2, 2);
    };

    WebGLRenderTarget.prototype.setColorTexture3 = function (colorTexture3) {
        var oldColorTexture3 = this.colorTexture3;
        debug.assert(oldColorTexture3 && colorTexture3 && oldColorTexture3.width === colorTexture3.width && oldColorTexture3.height === colorTexture3.height && oldColorTexture3.format === colorTexture3.format && oldColorTexture3.cubemap === colorTexture3.cubemap);
        this.colorTexture3 = (colorTexture3);
        this._updateColorAttachement(this.colorTexture3, 3);
    };

    WebGLRenderTarget.prototype.destroy = function () {
        var gd = this._gd;
        if (gd) {
            var glObject = this._glObject;
            if (glObject) {
                var gl = gd._gl;
                if (gl) {
                    gl.deleteFramebuffer(glObject);
                }
                delete this._glObject;
            }

            delete this.colorTexture0;
            delete this.colorTexture1;
            delete this.colorTexture2;
            delete this.colorTexture3;
            delete this.depthBuffer;
            delete this.depthTexture;
            delete this._gd;
        }
    };

    WebGLRenderTarget.create = function (gd, params) {
        var renderTarget = new WebGLRenderTarget();

        var colorTexture0 = (params.colorTexture0);
        var colorTexture1 = (colorTexture0 ? (params.colorTexture1 || null) : null);
        var colorTexture2 = (colorTexture1 ? (params.colorTexture2 || null) : null);
        var colorTexture3 = (colorTexture2 ? (params.colorTexture3 || null) : null);
        var depthBuffer = (params.depthBuffer || null);
        var depthTexture = (params.depthTexture || null);
        var face = params.face;

        var maxSupported = gd.maxSupported("RENDERTARGET_COLOR_TEXTURES");
        if (colorTexture1 && maxSupported < 2) {
            return null;
        }
        if (colorTexture2 && maxSupported < 3) {
            return null;
        }
        if (colorTexture3 && maxSupported < 4) {
            return null;
        }

        var gl = gd._gl;
        var colorAttachment0 = gl.COLOR_ATTACHMENT0;

        var glObject = gl.createFramebuffer();

        gl.bindFramebuffer(gl.FRAMEBUFFER, glObject);

        var width, height;
        if (colorTexture0) {
            width = colorTexture0.width;
            height = colorTexture0.height;

            var glTexture = colorTexture0._glTexture;
            if (glTexture === undefined) {
                TurbulenzEngine.callOnError("Color texture is not a Texture");
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.deleteFramebuffer(glObject);
                return null;
            }

            if (colorTexture0.cubemap) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, colorAttachment0, (gl.TEXTURE_CUBE_MAP_POSITIVE_X + face), glTexture, 0);
            } else {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, colorAttachment0, gl.TEXTURE_2D, glTexture, 0);
            }

            if (colorTexture1) {
                glTexture = colorTexture1._glTexture;
                if (colorTexture1.cubemap) {
                    gl.framebufferTexture2D(gl.FRAMEBUFFER, (colorAttachment0 + 1), (gl.TEXTURE_CUBE_MAP_POSITIVE_X + face), glTexture, 0);
                } else {
                    gl.framebufferTexture2D(gl.FRAMEBUFFER, (colorAttachment0 + 1), gl.TEXTURE_2D, glTexture, 0);
                }

                if (colorTexture2) {
                    glTexture = colorTexture2._glTexture;
                    if (colorTexture1.cubemap) {
                        gl.framebufferTexture2D(gl.FRAMEBUFFER, (colorAttachment0 + 2), (gl.TEXTURE_CUBE_MAP_POSITIVE_X + face), glTexture, 0);
                    } else {
                        gl.framebufferTexture2D(gl.FRAMEBUFFER, (colorAttachment0 + 2), gl.TEXTURE_2D, glTexture, 0);
                    }

                    if (colorTexture3) {
                        glTexture = colorTexture3._glTexture;
                        if (colorTexture1.cubemap) {
                            gl.framebufferTexture2D(gl.FRAMEBUFFER, (colorAttachment0 + 3), (gl.TEXTURE_CUBE_MAP_POSITIVE_X + face), glTexture, 0);
                        } else {
                            gl.framebufferTexture2D(gl.FRAMEBUFFER, (colorAttachment0 + 3), gl.TEXTURE_2D, glTexture, 0);
                        }
                    }
                }
            }
        } else if (depthTexture) {
            width = depthTexture.width;
            height = depthTexture.height;
        } else if (depthBuffer) {
            width = depthBuffer.width;
            height = depthBuffer.height;
        } else {
            TurbulenzEngine.callOnError("No RenderBuffers or Textures specified for this RenderTarget");
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.deleteFramebuffer(glObject);
            return null;
        }

        if (depthTexture) {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, depthTexture._glDepthAttachment, gl.TEXTURE_2D, depthTexture._glTexture, 0);
        } else if (depthBuffer) {
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, depthBuffer._glDepthAttachment, gl.RENDERBUFFER, depthBuffer._glBuffer);
        }

        var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            gl.deleteFramebuffer(glObject);
            return null;
        }

        renderTarget._gd = gd;
        renderTarget._glObject = glObject;
        renderTarget.colorTexture0 = colorTexture0;
        renderTarget.colorTexture1 = colorTexture1;
        renderTarget.colorTexture2 = colorTexture2;
        renderTarget.colorTexture3 = colorTexture3;
        renderTarget.depthBuffer = depthBuffer;
        renderTarget.depthTexture = depthTexture;
        renderTarget.width = width;
        renderTarget.height = height;
        renderTarget.face = face;

        if (gd._drawBuffersExtension) {
            var buffers;
            if (colorTexture0) {
                buffers = [colorAttachment0];
                if (colorTexture1) {
                    buffers.push(colorAttachment0 + 1);
                    if (colorTexture2) {
                        buffers.push(colorAttachment0 + 2);
                        if (colorTexture3) {
                            buffers.push(colorAttachment0 + 3);
                        }
                    }
                }
            } else {
                buffers = [gl.NONE];
            }
            renderTarget._buffers = buffers;
        }

        renderTarget.id = ++gd._counters.renderTargets;

        return renderTarget;
    };
    WebGLRenderTarget.version = 1;
    return WebGLRenderTarget;
})();

WebGLRenderTarget.prototype._oldViewportBox = [];
WebGLRenderTarget.prototype._oldScissorBox = [];

;

var WebGLIndexBuffer = (function () {
    function WebGLIndexBuffer() {
    }
    WebGLIndexBuffer.prototype.map = function (offset, numIndices) {
        if (offset === undefined) {
            offset = 0;
        }
        if (numIndices === undefined) {
            numIndices = this.numIndices;
        }

        var gd = this._gd;
        var gl = gd._gl;

        var format = this.format;
        var data;
        if (format === gl.UNSIGNED_BYTE) {
            data = new Uint8Array(numIndices);
        } else if (format === gl.UNSIGNED_SHORT) {
            data = new Uint16Array(numIndices);
        } else {
            data = new Uint32Array(numIndices);
        }

        var numValues = 0;
        var writer = function indexBufferWriterFn() {
            var numArguments = arguments.length;
            for (var n = 0; n < numArguments; n += 1) {
                data[numValues] = arguments[n];
                numValues += 1;
            }
        };
        writer.write = writer;
        writer.data = data;
        writer.offset = offset;
        writer.getNumWrittenIndices = function getNumWrittenIndicesFn() {
            return numValues;
        };
        writer.write = writer;
        return writer;
    };

    WebGLIndexBuffer.prototype.unmap = function (writer) {
        if (writer) {
            var gd = this._gd;
            var gl = gd._gl;

            var data = writer.data;
            delete writer.data;

            var offset = writer.offset;

            delete writer.write;

            var numIndices = writer.getNumWrittenIndices();
            if (!numIndices) {
                return;
            }

            if (numIndices < data.length) {
                data = data.subarray(0, numIndices);
            }

            gd.setIndexBuffer(this);

            if (numIndices < this.numIndices) {
                gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, offset, data);
            } else {
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, this._usage);
            }
        }
    };

    WebGLIndexBuffer.prototype.setData = function (data, offset, numIndices) {
        if (offset === undefined) {
            offset = 0;
        }
        if (numIndices === undefined) {
            numIndices = this.numIndices;
        }
        debug.assert(offset + numIndices <= this.numIndices, "IndexBuffer.setData: invalid 'offset' and/or " + "'numIndices' arguments");

        var gd = this._gd;
        var gl = gd._gl;

        var bufferData;
        var format = this.format;
        if (format === gl.UNSIGNED_BYTE) {
            if (data instanceof Uint8Array) {
                bufferData = data;
            } else {
                bufferData = new Uint8Array(data);
            }
        } else if (format === gl.UNSIGNED_SHORT) {
            if (data instanceof Uint16Array) {
                bufferData = data;
            } else {
                bufferData = new Uint16Array(data);
            }
            offset *= 2;
        } else if (format === gl.UNSIGNED_INT) {
            if (data instanceof Uint32Array) {
                bufferData = data;
            } else {
                bufferData = new Uint32Array(data);
            }
            offset *= 4;
        }
        data = undefined;

        if (numIndices < bufferData.length) {
            bufferData = bufferData.subarray(0, numIndices);
        }

        gd.setIndexBuffer(this);

        if (numIndices < this.numIndices) {
            gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, offset, bufferData);
        } else {
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, bufferData, this._usage);
        }
    };

    WebGLIndexBuffer.prototype.destroy = function () {
        var gd = this._gd;
        if (gd) {
            var glBuffer = this._glBuffer;
            if (glBuffer) {
                gd._deleteIndexBuffer(this);
                this._glBuffer = null;
            }
            this._gd = null;
        }
    };

    WebGLIndexBuffer.create = function (gd, params) {
        var gl = gd._gl;

        var ib = new WebGLIndexBuffer();
        ib._gd = gd;

        var numIndices = params.numIndices;
        ib.numIndices = numIndices;

        var format = params.format;
        if (typeof format === "string") {
            format = gd['INDEXFORMAT_' + format];
        }
        ib.format = format;

        var stride;
        if (format === gl.UNSIGNED_BYTE) {
            stride = 1;
        } else if (format === gl.UNSIGNED_SHORT) {
            stride = 2;
        } else {
            stride = 4;
        }
        ib._stride = stride;

        // Avoid dot notation lookup to prevent Google Closure complaining about transient being a keyword
        /* tslint:disable:no-string-literal */
        ib['transient'] = (params['transient'] || false);
        ib.dynamic = (params.dynamic || ib['transient']);
        ib._usage = (ib['transient'] ? gl.STREAM_DRAW : (ib.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW));

        /* tslint:enable:no-string-literal */
        ib._glBuffer = gl.createBuffer();

        if (params.data) {
            ib.setData(params.data, 0, numIndices);
        } else {
            gd.setIndexBuffer(ib);

            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, (numIndices * stride), ib._usage);
        }

        ib.id = ++gd._counters.indexBuffers;

        return ib;
    };
    WebGLIndexBuffer.version = 1;
    return WebGLIndexBuffer;
})();

//
// WebGLSemantics
//
var WebGLSemantics = (function () {
    function WebGLSemantics(gd, semantics) {
        var numSemantics = semantics.length;
        this.length = numSemantics;
        for (var i = 0; i < numSemantics; i += 1) {
            var semantic = semantics[i];
            if (typeof semantic === "string") {
                this[i] = gd['SEMANTIC_' + semantic];
            } else {
                this[i] = semantic;
            }
        }
    }
    WebGLSemantics.create = function (gd, semantics) {
        return new WebGLSemantics(gd, semantics);
    };
    WebGLSemantics.version = 1;
    return WebGLSemantics;
})();



//
// WebGLVertexBuffer
//
var WebGLVertexBuffer = (function () {
    function WebGLVertexBuffer() {
    }
    WebGLVertexBuffer.prototype.map = function (offset, numVertices) {
        if (offset === undefined) {
            offset = 0;
        }
        if (numVertices === undefined) {
            numVertices = this.numVertices;
        }

        var gd = this._gd;
        var gl = gd._gl;

        var numValuesPerVertex = this.stride;
        var attributes = this.attributes;
        var numAttributes = attributes.length;

        var data, writer;
        var numValues = 0;

        if (this._hasSingleFormat) {
            var maxNumValues = (numVertices * numValuesPerVertex);
            var format = attributes[0].format;

            if (format === gl.FLOAT) {
                data = new Float32Array(maxNumValues);
            } else if (format === gl.BYTE) {
                data = new Int8Array(maxNumValues);
            } else if (format === gl.UNSIGNED_BYTE) {
                data = new Uint8Array(maxNumValues);
            } else if (format === gl.SHORT) {
                data = new Int16Array(maxNumValues);
            } else if (format === gl.UNSIGNED_SHORT) {
                data = new Uint16Array(maxNumValues);
            } else if (format === gl.INT) {
                data = new Int32Array(maxNumValues);
            } else if (format === gl.UNSIGNED_INT) {
                data = new Uint32Array(maxNumValues);
            }

            writer = function vertexBufferWriterSingleFn() {
                var numArguments = arguments.length;
                var currentArgument = 0;
                for (var a = 0; a < numAttributes; a += 1) {
                    var attribute = attributes[a];
                    var numComponents = attribute.numComponents;
                    var currentComponent = 0, j;
                    do {
                        if (currentArgument < numArguments) {
                            var value = arguments[currentArgument];
                            currentArgument += 1;
                            if (typeof value === "number") {
                                if (attribute.normalized) {
                                    value *= attribute.normalizationScale;
                                }
                                data[numValues] = value;
                                numValues += 1;
                                currentComponent += 1;
                            } else if (currentComponent === 0) {
                                var numSubArguments = value.length;
                                if (numSubArguments > numComponents) {
                                    numSubArguments = numComponents;
                                }
                                if (attribute.normalized) {
                                    var scale = attribute.normalizationScale;
                                    for (j = 0; j < numSubArguments; j += 1) {
                                        data[numValues] = (value[j] * scale);
                                        numValues += 1;
                                        currentComponent += 1;
                                    }
                                } else {
                                    for (j = 0; j < numSubArguments; j += 1) {
                                        data[numValues] = value[j];
                                        numValues += 1;
                                        currentComponent += 1;
                                    }
                                }
                                while (currentComponent < numComponents) {
                                    // No need to clear to zeros
                                    numValues += 1;
                                    currentComponent += 1;
                                }
                                break;
                            } else {
                                TurbulenzEngine.callOnError('Missing values for attribute ' + a);
                                return null;
                            }
                        } else {
                            // No need to clear to zeros
                            numValues += 1;
                            currentComponent += 1;
                        }
                    } while(currentComponent < numComponents);
                }
            };
        } else {
            var destOffset = 0;
            var bufferSize = (numVertices * this._strideInBytes);

            data = new ArrayBuffer(bufferSize);

            if (typeof DataView !== 'undefined' && 'setFloat32' in DataView.prototype) {
                var dataView = new DataView(data);

                writer = function vertexBufferWriterDataViewFn() {
                    var numArguments = arguments.length;
                    var currentArgument = 0;
                    for (var a = 0; a < numAttributes; a += 1) {
                        var attribute = attributes[a];
                        var numComponents = attribute.numComponents;
                        var setter = attribute.typedSetter;
                        var componentStride = attribute.componentStride;
                        var currentComponent = 0, j;
                        do {
                            if (currentArgument < numArguments) {
                                var value = arguments[currentArgument];
                                currentArgument += 1;
                                if (typeof value === "number") {
                                    if (attribute.normalized) {
                                        value *= attribute.normalizationScale;
                                    }
                                    setter.call(dataView, destOffset, value, true);
                                    destOffset += componentStride;
                                    currentComponent += 1;
                                    numValues += 1;
                                } else if (currentComponent === 0) {
                                    var numSubArguments = value.length;
                                    if (numSubArguments > numComponents) {
                                        numSubArguments = numComponents;
                                    }
                                    if (attribute.normalized) {
                                        var scale = attribute.normalizationScale;
                                        for (j = 0; j < numSubArguments; j += 1) {
                                            setter.call(dataView, destOffset, (value[j] * scale), true);
                                            destOffset += componentStride;
                                            currentComponent += 1;
                                            numValues += 1;
                                        }
                                    } else {
                                        for (j = 0; j < numSubArguments; j += 1) {
                                            setter.call(dataView, destOffset, value[j], true);
                                            destOffset += componentStride;
                                            currentComponent += 1;
                                            numValues += 1;
                                        }
                                    }
                                    while (currentComponent < numComponents) {
                                        // No need to clear to zeros
                                        numValues += 1;
                                        currentComponent += 1;
                                    }
                                    break;
                                } else {
                                    TurbulenzEngine.callOnError('Missing values for attribute ' + a);
                                    return null;
                                }
                            } else {
                                // No need to clear to zeros
                                numValues += 1;
                                currentComponent += 1;
                            }
                        } while(currentComponent < numComponents);
                    }
                };
            } else {
                writer = function vertexBufferWriterMultiFn() {
                    var numArguments = arguments.length;
                    var currentArgument = 0;
                    var dest;
                    for (var a = 0; a < numAttributes; a += 1) {
                        var attribute = attributes[a];
                        var numComponents = attribute.numComponents;
                        dest = new attribute.typedArray(data, destOffset, numComponents);
                        destOffset += attribute.stride;

                        var currentComponent = 0, j;
                        do {
                            if (currentArgument < numArguments) {
                                var value = arguments[currentArgument];
                                currentArgument += 1;
                                if (typeof value === "number") {
                                    if (attribute.normalized) {
                                        value *= attribute.normalizationScale;
                                    }
                                    dest[currentComponent] = value;
                                    currentComponent += 1;
                                    numValues += 1;
                                } else if (currentComponent === 0) {
                                    var numSubArguments = value.length;
                                    if (numSubArguments > numComponents) {
                                        numSubArguments = numComponents;
                                    }
                                    if (attribute.normalized) {
                                        var scale = attribute.normalizationScale;
                                        for (j = 0; j < numSubArguments; j += 1) {
                                            dest[currentComponent] = (value[j] * scale);
                                            currentComponent += 1;
                                            numValues += 1;
                                        }
                                    } else {
                                        for (j = 0; j < numSubArguments; j += 1) {
                                            dest[currentComponent] = value[j];
                                            currentComponent += 1;
                                            numValues += 1;
                                        }
                                    }
                                    while (currentComponent < numComponents) {
                                        // No need to clear to zeros
                                        currentComponent += 1;
                                        numValues += 1;
                                    }
                                    break;
                                } else {
                                    TurbulenzEngine.callOnError('Missing values for attribute ' + a);
                                    return null;
                                }
                            } else {
                                // No need to clear to zeros
                                currentComponent += 1;
                                numValues += 1;
                            }
                        } while(currentComponent < numComponents);
                    }
                };
            }
        }

        writer.data = data;
        writer.offset = offset;
        writer.getNumWrittenVertices = function getNumWrittenVerticesFn() {
            return Math.floor(numValues / numValuesPerVertex);
        };
        writer.getNumWrittenValues = function getNumWrittenValuesFn() {
            return numValues;
        };
        writer.write = writer;
        return writer;
    };

    WebGLVertexBuffer.prototype.unmap = function (writer) {
        if (writer) {
            var data = writer.data;
            delete writer.data;

            delete writer.write;

            var numVertices = writer.getNumWrittenVertices();
            if (!numVertices) {
                return;
            }

            var offset = writer.offset;

            var stride = this._strideInBytes;

            if (this._hasSingleFormat) {
                var numValues = writer.getNumWrittenValues();
                if (numValues < data.length) {
                    data = data.subarray(0, numValues);
                }
            } else {
                var numBytes = (numVertices * stride);
                if (numBytes < data.byteLength) {
                    data = data.slice(0, numBytes);
                }
            }

            var gd = this._gd;
            var gl = gd._gl;

            gd.bindVertexBuffer(this._glBuffer);

            if (numVertices < this.numVertices) {
                gl.bufferSubData(gl.ARRAY_BUFFER, (offset * stride), data);
            } else {
                gl.bufferData(gl.ARRAY_BUFFER, data, this._usage);
            }
        }
    };

    WebGLVertexBuffer.prototype.setData = function (data, offset, numVertices) {
        if (offset === undefined) {
            offset = 0;
        }
        if (numVertices === undefined) {
            numVertices = this.numVertices;
        }

        var gd = this._gd;
        var gl = gd._gl;
        var strideInBytes = this._strideInBytes;

        // Fast path for ArrayBuffer data
        if (data.constructor === ArrayBuffer) {
            gd.bindVertexBuffer(this._glBuffer);

            if (numVertices < this.numVertices) {
                gl.bufferSubData(gl.ARRAY_BUFFER, (offset * strideInBytes), data);
            } else {
                gl.bufferData(gl.ARRAY_BUFFER, data, this._usage);
            }
            return;
        }

        var attributes = this.attributes;
        var numAttributes = this.numAttributes;
        var attribute, format, bufferData, TypedArrayConstructor;

        if (this._hasSingleFormat) {
            attribute = attributes[0];
            format = attribute.format;

            if (format === gl.FLOAT) {
                if (!(data instanceof Float32Array)) {
                    TypedArrayConstructor = Float32Array;
                }
            } else if (format === gl.BYTE) {
                if (!(data instanceof Int8Array)) {
                    TypedArrayConstructor = Int8Array;
                }
            } else if (format === gl.UNSIGNED_BYTE) {
                if (!(data instanceof Uint8Array)) {
                    TypedArrayConstructor = Uint8Array;
                }
            } else if (format === gl.SHORT) {
                if (!(data instanceof Int16Array)) {
                    TypedArrayConstructor = Int16Array;
                }
            } else if (format === gl.UNSIGNED_SHORT) {
                if (!(data instanceof Uint16Array)) {
                    TypedArrayConstructor = Uint16Array;
                }
            } else if (format === gl.INT) {
                if (!(data instanceof Int32Array)) {
                    TypedArrayConstructor = Int32Array;
                }
            } else if (format === gl.UNSIGNED_INT) {
                if (!(data instanceof Uint32Array)) {
                    TypedArrayConstructor = Uint32Array;
                }
            }

            var numValuesPerVertex = this.stride;
            var numValues = (numVertices * numValuesPerVertex);

            if (TypedArrayConstructor) {
                // Data has to be put into a Typed Array and
                // potentially normalized.
                if (attribute.normalized) {
                    data = this.scaleValues(data, attribute.normalizationScale, numValues);
                }
                bufferData = new TypedArrayConstructor(data);
                if (numValues < bufferData.length) {
                    bufferData = bufferData.subarray(0, numValues);
                }
            } else {
                bufferData = data;
            }

            if (numValues < data.length) {
                bufferData = bufferData.subarray(0, numValues);
            }
        } else {
            var bufferSize = (numVertices * strideInBytes);

            bufferData = new ArrayBuffer(bufferSize);

            var srcOffset = 0, destOffset = 0, v, c, a, numComponents, componentStride, scale;
            if (typeof DataView !== 'undefined' && 'setFloat32' in DataView.prototype) {
                var dataView = new DataView(bufferData);

                for (v = 0; v < numVertices; v += 1) {
                    for (a = 0; a < numAttributes; a += 1) {
                        attribute = attributes[a];
                        numComponents = attribute.numComponents;
                        componentStride = attribute.componentStride;
                        var setter = attribute.typedSetter;
                        if (attribute.normalized) {
                            scale = attribute.normalizationScale;
                            for (c = 0; c < numComponents; c += 1) {
                                setter.call(dataView, destOffset, (data[srcOffset] * scale), true);
                                destOffset += componentStride;
                                srcOffset += 1;
                            }
                        } else {
                            for (c = 0; c < numComponents; c += 1) {
                                setter.call(dataView, destOffset, data[srcOffset], true);
                                destOffset += componentStride;
                                srcOffset += 1;
                            }
                        }
                    }
                }
            } else {
                for (v = 0; v < numVertices; v += 1) {
                    for (a = 0; a < numAttributes; a += 1) {
                        attribute = attributes[a];
                        numComponents = attribute.numComponents;
                        var dest = new attribute.typedArray(bufferData, destOffset, numComponents);
                        destOffset += attribute.stride;
                        if (attribute.normalized) {
                            scale = attribute.normalizationScale;
                            for (c = 0; c < numComponents; c += 1) {
                                dest[c] = (data[srcOffset] * scale);
                                srcOffset += 1;
                            }
                        } else {
                            for (c = 0; c < numComponents; c += 1) {
                                dest[c] = data[srcOffset];
                                srcOffset += 1;
                            }
                        }
                    }
                }
            }
        }
        data = undefined;

        gd.bindVertexBuffer(this._glBuffer);

        if (numVertices < this.numVertices) {
            gl.bufferSubData(gl.ARRAY_BUFFER, (offset * strideInBytes), bufferData);
        } else {
            gl.bufferData(gl.ARRAY_BUFFER, bufferData, this._usage);
        }
    };

    // Internal
    WebGLVertexBuffer.prototype.scaleValues = function (values, scale, numValues) {
        if (numValues === undefined) {
            numValues = values.length;
        }
        var scaledValues = new values.constructor(numValues);
        for (var n = 0; n < numValues; n += 1) {
            scaledValues[n] = (values[n] * scale);
        }
        return scaledValues;
    };

    WebGLVertexBuffer.prototype.bindAttributes = function (semantics, offset) {
        var numAttributes = Math.min(semantics.length, this.numAttributes);
        var vertexAttributes = this.attributes;
        var stride = this._strideInBytes;
        var gd = this._gd;
        var gl = gd._gl;
        var attributeMask = 0;
        for (var n = 0; n < numAttributes; n += 1) {
            var semantic = semantics[n];

            /* tslint:disable:no-bitwise */
            attributeMask |= (1 << semantic);

            /* tslint:enable:no-bitwise */
            var vertexAttribute = vertexAttributes[n];

            gl.vertexAttribPointer(semantic, vertexAttribute.numComponents, vertexAttribute.format, vertexAttribute.normalized, stride, offset);

            offset += vertexAttribute.stride;
        }
        if (debug) {
            gd.metrics.vertexAttributesChanges += numAttributes;
        }
        return attributeMask;
    };

    WebGLVertexBuffer.prototype.bindAttributesCached = function (semantics, offset) {
        var numAttributes = Math.min(semantics.length, this.numAttributes);
        var vertexAttributes = this.attributes;
        var stride = this._strideInBytes;
        var gd = this._gd;
        var gl = gd._gl;
        var semanticsOffsets = gd._semanticsOffsets;
        var attributeMask = 0;
        for (var n = 0; n < numAttributes; n += 1) {
            var semantic = semantics[n];

            /* tslint:disable:no-bitwise */
            attributeMask |= (1 << semantic);

            /* tslint:enable:no-bitwise */
            var vertexAttribute = vertexAttributes[n];

            var semanticsOffset = semanticsOffsets[semantic];
            if (semanticsOffset.vertexBuffer !== this || semanticsOffset.offset !== offset) {
                semanticsOffset.vertexBuffer = this;
                semanticsOffset.offset = offset;

                gl.vertexAttribPointer(semantic, vertexAttribute.numComponents, vertexAttribute.format, vertexAttribute.normalized, stride, offset);

                if (debug) {
                    gd.metrics.vertexAttributesChanges += 1;
                }
            }

            offset += vertexAttribute.stride;
        }
        return attributeMask;
    };

    WebGLVertexBuffer.prototype.setAttributes = function (attributes) {
        var gd = this._gd;

        var numAttributes = attributes.length;
        this.numAttributes = numAttributes;
        this.attributes = [];

        var stride = 0, numValuesPerVertex = 0, hasSingleFormat = true;
        for (var i = 0; i < numAttributes; i += 1) {
            var format = attributes[i];
            if (typeof format === "string") {
                format = gd['VERTEXFORMAT_' + format];
            }
            this.attributes[i] = format;
            stride += format.stride;
            numValuesPerVertex += format.numComponents;

            if (hasSingleFormat && i) {
                if (format.format !== this.attributes[i - 1].format) {
                    hasSingleFormat = false;
                }
            }
        }

        this._strideInBytes = stride;
        this.stride = numValuesPerVertex;
        this._hasSingleFormat = hasSingleFormat;

        return stride;
    };

    WebGLVertexBuffer.prototype.resize = function (size) {
        if (size !== (this._strideInBytes * this.numVertices)) {
            var gd = this._gd;
            var gl = gd._gl;

            gd.bindVertexBuffer(this._glBuffer);

            var bufferType = gl.ARRAY_BUFFER;
            gl.bufferData(bufferType, size, this._usage);

            var bufferSize = gl.getBufferParameter(bufferType, gl.BUFFER_SIZE);
            this.numVertices = Math.floor(bufferSize / this._strideInBytes);
        }
    };

    WebGLVertexBuffer.prototype.destroy = function () {
        var gd = this._gd;
        if (gd) {
            var glBuffer = this._glBuffer;
            if (glBuffer) {
                gd._deleteVertexBuffer(this);
                this._glBuffer = null;
            }

            this._gd = null;
        }
    };

    WebGLVertexBuffer.create = function (gd, params) {
        var gl = gd._gl;

        var vb = new WebGLVertexBuffer();
        vb._gd = gd;

        var numVertices = params.numVertices;
        vb.numVertices = numVertices;

        var strideInBytes = vb.setAttributes(params.attributes);

        // Avoid dot notation lookup to prevent Google Closure complaining
        // about transient being a keyword
        /* tslint:disable:no-string-literal */
        vb['transient'] = (params['transient'] || false);
        vb.dynamic = (params.dynamic || vb['transient']);
        vb._usage = (vb['transient'] ? gl.STREAM_DRAW : (vb.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW));

        /* tslint:enable:no-string-literal */
        vb._glBuffer = gl.createBuffer();

        var bufferSize = (numVertices * strideInBytes);

        if (params.data) {
            vb.setData(params.data, 0, numVertices);
        } else {
            gd.bindVertexBuffer(vb._glBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, bufferSize, vb._usage);
        }

        vb.id = ++gd._counters.vertexBuffers;

        return vb;
    };
    WebGLVertexBuffer.version = 1;
    return WebGLVertexBuffer;
})();

;

;

var WebGLShaderProgram = (function () {
    function WebGLShaderProgram(gd, programs, parameters, programNames, semanticNames, parameterNames) {
        var gl = gd._gl;

        // Create GL program
        var glProgram = gl.createProgram();

        var numPrograms = programNames.length;
        var p;
        for (p = 0; p < numPrograms; p += 1) {
            var glShader = programs[programNames[p]];
            if (glShader) {
                gl.attachShader(glProgram, glShader);
            }
        }

        var numSemantics = semanticNames.length;
        var semanticsMask = 0;
        var s;
        for (s = 0; s < numSemantics; s += 1) {
            var semanticName = semanticNames[s];
            var semantic = gd['SEMANTIC_' + semanticName];
            if (semantic !== undefined) {
                /* tslint:disable:no-bitwise */
                semanticsMask |= (1 << semantic);

                /* tslint:enable:no-bitwise */
                if (0 === semanticName.indexOf("ATTR")) {
                    gl.bindAttribLocation(glProgram, semantic, semanticName);
                } else {
                    var attributeName = WebGLPass.semanticToAttr[semanticName];
                    gl.bindAttribLocation(glProgram, semantic, attributeName);
                }
            }
        }

        gl.linkProgram(glProgram);

        // Set parameters
        var numTextureUnits = 0;
        var programParameters = {};
        var programParametersArray = [];
        var numParameters = parameterNames ? parameterNames.length : 0;
        var n;
        for (n = 0; n < numParameters; n += 1) {
            var parameterName = parameterNames[n];

            var paramInfo = parameters[parameterName];

            var parameter = {
                current: null,
                info: paramInfo,
                location: null,
                values: null,
                textureUnit: -1
            };

            if (paramInfo) {
                if (paramInfo.sampler) {
                    parameter.textureUnit = numTextureUnits;
                    numTextureUnits += 1;
                } else if (paramInfo.numValues === 1) {
                    if (paramInfo.type === "bool") {
                        parameter.values = !!paramInfo.values[0];
                    } else {
                        parameter.values = paramInfo.values[0];
                    }
                } else if (paramInfo.type === "float") {
                    parameter.values = new Float32Array(paramInfo.values);
                } else {
                    parameter.values = new Int32Array(paramInfo.values);
                }
                parameter.current = parameter.values;
            }

            programParameters[parameterName] = parameter;
            programParametersArray[n] = parameter;
        }

        this.glProgram = glProgram;
        this.semanticsMask = semanticsMask;
        this.parameters = programParameters;
        this.parametersArray = programParametersArray;
        this.numTextureUnits = numTextureUnits;
        this._initialized = false;
    }
    WebGLShaderProgram.prototype.initialize = function (gd) {
        if (this._initialized) {
            return;
        }

        var gl = gd._gl;

        var glProgram = this.glProgram;

        gd.setProgram(glProgram);

        var parameters = this.parameters;
        for (var p in parameters) {
            if (parameters.hasOwnProperty(p)) {
                var parameter = parameters[p];

                var paramInfo = parameter.info;
                if (paramInfo) {
                    var location = gl.getUniformLocation(glProgram, p);
                    if (null !== location) {
                        parameter.location = location;

                        if (paramInfo.sampler) {
                            gl.uniform1i(location, parameter.textureUnit);
                        } else {
                            var parameterValues = paramInfo.values;

                            var numColumns;
                            if (paramInfo.type === 'float') {
                                numColumns = paramInfo.columns;
                                if (4 === numColumns) {
                                    gl.uniform4fv(location, parameterValues);
                                } else if (3 === numColumns) {
                                    gl.uniform3fv(location, parameterValues);
                                } else if (2 === numColumns) {
                                    gl.uniform2fv(location, parameterValues);
                                } else if (1 === paramInfo.rows) {
                                    gl.uniform1f(location, parameterValues[0]);
                                } else {
                                    gl.uniform1fv(location, parameterValues);
                                }
                            } else {
                                numColumns = paramInfo.columns;
                                if (4 === numColumns) {
                                    gl.uniform4iv(location, parameterValues);
                                } else if (3 === numColumns) {
                                    gl.uniform3iv(location, parameterValues);
                                } else if (2 === numColumns) {
                                    gl.uniform2iv(location, parameterValues);
                                } else if (1 === paramInfo.rows) {
                                    gl.uniform1i(location, parameterValues[0]);
                                } else {
                                    gl.uniform1iv(location, parameterValues);
                                }
                            }
                        }
                    }
                }
            }
        }

        this._initialized = true;
    };
    return WebGLShaderProgram;
})();
;

;

;

;

var WebGLPass = (function () {
    function WebGLPass(gd, shader, params) {
        this.name = (params.name || null);

        var programNames = params.programs;
        var states = params.states;

        var compoundProgramName = programNames.join(':');
        var linkedProgram = shader._linkedPrograms[compoundProgramName];
        if (linkedProgram === undefined) {
            linkedProgram = new WebGLShaderProgram(gd, shader._programs, shader._parameters, programNames, params.semantics, params.parameters);
            shader._linkedPrograms[compoundProgramName] = linkedProgram;
        }

        /*else
        {
        console.log('Reused program ' + compoundProgramName);
        }
        */
        this.glProgram = linkedProgram.glProgram;
        this.semanticsMask = linkedProgram.semanticsMask;
        this.parameters = linkedProgram.parameters;
        this.parametersArray = linkedProgram.parametersArray;
        this.numTextureUnits = linkedProgram.numTextureUnits;
        this.numParameters = linkedProgram.parametersArray.length;
        this._linkedProgram = linkedProgram;

        function equalRenderStates(defaultValues, values) {
            var numDefaultValues = defaultValues.length;
            var n;
            for (n = 0; n < numDefaultValues; n += 1) {
                if (defaultValues[n] !== values[n]) {
                    return false;
                }
            }
            return true;
        }

        var stateHandlers = gd._stateHandlers;
        var passStates = [];
        var passStatesSet = {};
        this.states = passStates;
        this.statesSet = passStatesSet;
        var s;
        for (s in states) {
            if (states.hasOwnProperty(s)) {
                var stateHandler = stateHandlers[s];
                if (stateHandler) {
                    var values = stateHandler.parse(states[s]);
                    if (values !== null) {
                        if (equalRenderStates(stateHandler.defaultValues, values)) {
                            continue;
                        }
                        passStates.push({
                            name: s,
                            set: stateHandler.set,
                            reset: stateHandler.reset,
                            values: values
                        });
                        passStatesSet[s] = true;
                    } else {
                        TurbulenzEngine.callOnError('Unknown value for state ' + s + ': ' + states[s]);
                    }
                }
            }
        }

        this.dirty = false;
    }
    WebGLPass.prototype.initialize = function (gd) {
        this._linkedProgram.initialize(gd);
    };

    WebGLPass.prototype.updateParametersData = function (gd) {
        this.dirty = false;

        // Set parameters
        var parameters = this.parametersArray;
        var numParameters = parameters.length;
        var n;
        for (n = 0; n < numParameters; n += 1) {
            var parameter = parameters[n];
            if (parameter.dirty) {
                parameter.dirty = 0;

                var paramInfo = parameter.info;
                if (paramInfo) {
                    var parameterValues = paramInfo.values;

                    var numColumns;
                    if (paramInfo.type === 'float') {
                        numColumns = paramInfo.columns;
                        if (4 === numColumns) {
                            gd._setUniform4fv(parameter.location, parameter.values, parameterValues);
                        } else if (3 === numColumns) {
                            gd._setUniform3fv(parameter.location, parameter.values, parameterValues);
                        } else if (2 === numColumns) {
                            gd._setUniform2fv(parameter.location, parameter.values, parameterValues);
                        } else if (1 === paramInfo.rows) {
                            gd._setUniform1f(parameter, parameterValues[0]);
                        } else {
                            gd._setUniform1fv(parameter.location, parameter.values, parameterValues);
                        }
                    } else if (paramInfo.sampler !== undefined) {
                        gd._setTexture(parameter.textureUnit, parameterValues, paramInfo.sampler);
                    } else {
                        numColumns = paramInfo.columns;
                        if (4 === numColumns) {
                            gd._setUniform4iv(parameter.location, parameter.values, parameterValues);
                        } else if (3 === numColumns) {
                            gd._setUniform3iv(parameter.location, parameter.values, parameterValues);
                        } else if (2 === numColumns) {
                            gd._setUniform2iv(parameter.location, parameter.values, parameterValues);
                        } else if (1 === paramInfo.rows) {
                            gd._setUniform1i(parameter, parameterValues[0]);
                        } else {
                            gd._setUniform1iv(parameter.location, parameter.values, parameterValues);
                        }
                    }
                }
            }
        }
    };

    WebGLPass.prototype.destroy = function () {
        delete this.glProgram;
        delete this.semanticsMask;
        delete this.parametersArray;
        delete this.parameters;
        delete this.states;
        delete this.statesSet;
    };
    WebGLPass.version = 1;

    WebGLPass.semanticToAttr = {
        POSITION: "ATTR0",
        POSITION0: "ATTR0",
        BLENDWEIGHT: "ATTR1",
        BLENDWEIGHT0: "ATTR1",
        NORMAL: "ATTR2",
        NORMAL0: "ATTR2",
        COLOR: "ATTR3",
        COLOR0: "ATTR3",
        COLOR1: "ATTR4",
        SPECULAR: "ATTR4",
        FOGCOORD: "ATTR5",
        TESSFACTOR: "ATTR5",
        PSIZE0: "ATTR6",
        BLENDINDICES: "ATTR7",
        BLENDINDICES0: "ATTR7",
        TEXCOORD: "ATTR8",
        TEXCOORD0: "ATTR8",
        TEXCOORD1: "ATTR9",
        TEXCOORD2: "ATTR10",
        TEXCOORD3: "ATTR11",
        TEXCOORD4: "ATTR12",
        TEXCOORD5: "ATTR13",
        TEXCOORD6: "ATTR14",
        TEXCOORD7: "ATTR15",
        TANGENT: "ATTR14",
        TANGENT0: "ATTR14",
        BINORMAL0: "ATTR15",
        BINORMAL: "ATTR15",
        PSIZE: "ATTR6"
    };
    return WebGLPass;
})();

//
// WebGLTechnique
//
var WebGLTechnique = (function () {
    function WebGLTechnique(gd, shader, name, passes) {
        this.initialized = false;
        this.shader = shader;
        this.name = name;

        var numPasses = passes.length, n;
        var numParameters = 0;
        this.passes = [];
        this.numPasses = numPasses;
        for (n = 0; n < numPasses; n += 1) {
            var passParams = passes[n];
            if (passParams.parameters) {
                numParameters += passParams.parameters.length;
            }
            this.passes[n] = new WebGLPass(gd, shader, passParams);
        }

        this.numParameters = numParameters;

        this.device = null;

        this.id = ++gd._counters.techniques;

        if (1 < numPasses) {
            if (gd.drawArray !== gd.drawArrayMultiPass) {
                gd.drawArray = gd.drawArrayMultiPass;
                debug.log("Detected technique with multiple passes, switching to multi pass support.");
            }
        }
    }
    WebGLTechnique.prototype.getPass = function (id) {
        var passes = this.passes;
        var numPasses = passes.length;
        if (typeof id === "string") {
            for (var n = 0; n < numPasses; n += 1) {
                var pass = passes[n];
                if (pass.name === id) {
                    return pass;
                }
            }
        } else {
            /* tslint:disable:no-bitwise */
            id = (id | 0);

            /* tslint:enable:no-bitwise */
            if (id < numPasses) {
                return passes[id];
            }
        }
        return null;
    };

    WebGLTechnique.prototype.activate = function (gd) {
        this.device = gd;

        if (!this.initialized) {
            this.shader.initialize(gd);
            this.initialize(gd);
        }

        if (debug) {
            gd.metrics.techniqueChanges += 1;
        }
    };

    WebGLTechnique.prototype.deactivate = function () {
        this.device = null;
    };

    WebGLTechnique.prototype.checkProperties = function (gd) {
        // Check for parameters set directly into the technique...
        var fakeTechniqueParameters = {}, p;
        for (p in this) {
            if (p !== 'version' && p !== 'name' && p !== 'id' && p !== 'passes' && p !== 'numPasses' && p !== 'device' && p !== 'numParameters') {
                fakeTechniqueParameters[p] = this[p];
            }
        }

        if (fakeTechniqueParameters) {
            var passes = this.passes;
            if (passes.length === 1) {
                gd._setParameters(passes[0].parameters, fakeTechniqueParameters);
            } else {
                gd._setParametersDeferred(gd, passes, fakeTechniqueParameters);
            }

            for (p in fakeTechniqueParameters) {
                if (fakeTechniqueParameters.hasOwnProperty(p)) {
                    delete this[p];
                }
            }
        }
    };

    WebGLTechnique.prototype.initialize = function (gd) {
        if (this.initialized) {
            return;
        }

        var passes = this.passes;
        if (passes) {
            var numPasses = passes.length;
            var n;
            for (n = 0; n < numPasses; n += 1) {
                passes[n].initialize(gd);
            }
        }

        if (Object.defineProperty) {
            this.initializeParametersSetters();
        }

        this.initialized = true;
    };

    WebGLTechnique.prototype.initializeParametersSetters = function () {
        function make_sampler_setter(pass, parameter) {
            return function (parameterValues) {
                if (this.device) {
                    this.device._setTexture(parameter.textureUnit, parameterValues, parameter.info.sampler);
                } else {
                    pass.dirty = true;
                    parameter.dirty = 1;
                    parameter.info.values = parameterValues;
                }
            };
        }

        function make_float_uniform_setter(pass, parameter) {
            var paramInfo = parameter.info;

            function setDeferredParameter(parameterValues) {
                if (typeof parameterValues !== 'number') {
                    var values = paramInfo.values;
                    var numValues = Math.min(paramInfo.numValues, parameterValues.length);
                    for (var v = 0; v < numValues; v += 1) {
                        values[v] = parameterValues[v];
                    }
                    parameter.dirty = Math.max(numValues, (parameter.dirty || 0));
                } else {
                    paramInfo.values[0] = parameterValues;
                    parameter.dirty = (parameter.dirty || 1);
                }
                pass.dirty = true;
            }

            switch (paramInfo.columns) {
                case 1:
                    if (1 === paramInfo.numValues) {
                        return function (parameterValues) {
                            if (this.device) {
                                this.device._setUniform1f(parameter, parameterValues);
                            } else {
                                setDeferredParameter(parameterValues);
                            }
                        };
                    }
                    return function (parameterValues) {
                        if (this.device) {
                            this.device._setUniform1fv(parameter.location, parameter.values, parameterValues);
                        } else {
                            setDeferredParameter(parameterValues);
                        }
                    };
                case 2:
                    return function (parameterValues) {
                        if (this.device) {
                            this.device._setUniform2fv(parameter.location, parameter.values, parameterValues);
                        } else {
                            setDeferredParameter(parameterValues);
                        }
                    };
                case 3:
                    return function (parameterValues) {
                        if (this.device) {
                            this.device._setUniform3fv(parameter.location, parameter.values, parameterValues);
                        } else {
                            setDeferredParameter(parameterValues);
                        }
                    };
                case 4:
                    return function (parameterValues) {
                        if (this.device) {
                            this.device._setUniform4fv(parameter.location, parameter.values, parameterValues);
                        } else {
                            setDeferredParameter(parameterValues);
                        }
                    };
                default:
                    return null;
            }
        }

        function make_int_uniform_setter(pass, parameter) {
            var paramInfo = parameter.info;

            function setDeferredParameter(parameterValues) {
                if (typeof parameterValues !== 'number') {
                    var values = paramInfo.values;
                    var numValues = Math.min(paramInfo.numValues, parameterValues.length);
                    for (var v = 0; v < numValues; v += 1) {
                        values[v] = parameterValues[v];
                    }
                    parameter.dirty = Math.max(numValues, (parameter.dirty || 0));
                } else {
                    paramInfo.values[0] = parameterValues;
                    parameter.dirty = (parameter.dirty || 1);
                }
                pass.dirty = true;
            }

            switch (paramInfo.columns) {
                case 1:
                    if (1 === paramInfo.numValues) {
                        return function (parameterValues) {
                            if (this.device) {
                                this.device._setUniform1i(parameter, parameterValues);
                            } else {
                                setDeferredParameter(parameterValues);
                            }
                        };
                    }
                    return function (parameterValues) {
                        if (this.device) {
                            this.device._setUniform1iv(parameter.location, parameter.values, parameterValues);
                        } else {
                            setDeferredParameter(parameterValues);
                        }
                    };
                case 2:
                    return function (parameterValues) {
                        if (this.device) {
                            this.device._setUniform2iv(parameter.location, parameter.values, parameterValues);
                        } else {
                            setDeferredParameter(parameterValues);
                        }
                    };
                case 3:
                    return function (parameterValues) {
                        if (this.device) {
                            this.device._setUniform3iv(parameter.location, parameter.values, parameterValues);
                        } else {
                            setDeferredParameter(parameterValues);
                        }
                    };
                case 4:
                    return function (parameterValues) {
                        if (this.device) {
                            this.device._setUniform4iv(parameter.location, parameter.values, parameterValues);
                        } else {
                            setDeferredParameter(parameterValues);
                        }
                    };
                default:
                    return null;
            }
        }

        var passes = this.passes;
        var numPasses = passes.length;
        var pass, parameters, p, parameter, paramInfo, setter;
        if (numPasses === 1) {
            pass = passes[0];
            parameters = pass.parameters;
            for (p in parameters) {
                if (parameters.hasOwnProperty(p)) {
                    parameter = parameters[p];
                    paramInfo = parameter.info;
                    if (paramInfo) {
                        if (undefined !== parameter.location) {
                            if (paramInfo.sampler) {
                                setter = make_sampler_setter(pass, parameter);
                            } else {
                                if (paramInfo.type === 'float') {
                                    setter = make_float_uniform_setter(pass, parameter);
                                } else {
                                    setter = make_int_uniform_setter(pass, parameter);
                                }
                            }

                            Object.defineProperty(this, p, {
                                set: setter,
                                enumerable: false,
                                configurable: false
                            });
                        }
                    }
                }
            }

            this.checkProperties = null;
        } else {
            Object.defineProperty(this, 'device', {
                writable: true,
                enumerable: false,
                configurable: false
            });

            Object.defineProperty(this, 'version', {
                writable: false,
                enumerable: false,
                configurable: false
            });

            Object.defineProperty(this, 'name', {
                writable: false,
                enumerable: false,
                configurable: false
            });

            Object.defineProperty(this, 'id', {
                writable: false,
                enumerable: false,
                configurable: false
            });

            Object.defineProperty(this, 'passes', {
                writable: false,
                enumerable: false,
                configurable: false
            });

            Object.defineProperty(this, 'numParameters', {
                writable: false,
                enumerable: false,
                configurable: false
            });
        }
    };

    WebGLTechnique.prototype.destroy = function () {
        var passes = this.passes;
        if (passes) {
            var numPasses = passes.length;
            var n;

            for (n = 0; n < numPasses; n += 1) {
                passes[n].destroy();
            }

            passes.length = 0;

            delete this.passes;
        }

        delete this.device;
    };
    WebGLTechnique.version = 1;
    return WebGLTechnique;
})();

//
// TZWebGLShader
//
var TZWebGLShader = (function () {
    function TZWebGLShader() {
    }
    TZWebGLShader.prototype.getTechnique = function (name) {
        if (typeof name === "string") {
            return this._techniques[name];
        } else {
            var techniques = this._techniques;
            for (var t in techniques) {
                if (techniques.hasOwnProperty(t)) {
                    if (name === 0) {
                        return techniques[t];
                    } else {
                        name -= 1;
                    }
                }
            }
            return null;
        }
    };

    TZWebGLShader.prototype.getParameter = function (name) {
        if (typeof name === "string") {
            return this._parameters[name];
        } else {
            /* tslint:disable:no-bitwise */
            name = (name | 0);

            /* tslint:enable:no-bitwise */
            var parameters = this._parameters;
            for (var p in parameters) {
                if (parameters.hasOwnProperty(p)) {
                    if (name === 0) {
                        return parameters[p];
                    } else {
                        name -= 1;
                    }
                }
            }
            return null;
        }
    };

    TZWebGLShader.prototype.initialize = function (gd) {
        if (this._initialized) {
            return;
        }

        var gl = gd._gl;
        var p;

        // Check copmpiled programs as late as possible
        var shaderPrograms = this._programs;
        for (p in shaderPrograms) {
            if (shaderPrograms.hasOwnProperty(p)) {
                var compiledProgram = shaderPrograms[p];
                var compiled = gl.getShaderParameter(compiledProgram, gl.COMPILE_STATUS);
                if (!compiled) {
                    var compilerInfo = gl.getShaderInfoLog(compiledProgram);
                    TurbulenzEngine.callOnError('Program "' + p + '" failed to compile: ' + compilerInfo);
                }
            }
        }

        // Check linked programs as late as possible
        var linkedPrograms = this._linkedPrograms;
        for (p in linkedPrograms) {
            if (linkedPrograms.hasOwnProperty(p)) {
                var linkedProgram = linkedPrograms[p];
                var glProgram = linkedProgram.glProgram;
                if (glProgram) {
                    var linked = gl.getProgramParameter(glProgram, gl.LINK_STATUS);
                    if (!linked) {
                        var linkerInfo = gl.getProgramInfoLog(glProgram);
                        TurbulenzEngine.callOnError('Program "' + p + '" failed to link: ' + linkerInfo);
                    }
                }
            }
        }

        this._initialized = true;
    };

    TZWebGLShader.prototype.destroy = function () {
        var gd = this._gd;
        if (gd) {
            var gl = gd._gl;
            var p;

            var techniques = this._techniques;
            if (techniques) {
                for (p in techniques) {
                    if (techniques.hasOwnProperty(p)) {
                        techniques[p].destroy();
                    }
                }
                delete this._techniques;
            }

            var linkedPrograms = this._linkedPrograms;
            if (linkedPrograms) {
                if (gl) {
                    for (p in linkedPrograms) {
                        if (linkedPrograms.hasOwnProperty(p)) {
                            var linkedProgram = linkedPrograms[p];
                            var glProgram = linkedProgram.glProgram;
                            if (glProgram) {
                                gl.deleteProgram(glProgram);
                                delete linkedProgram.glProgram;
                            }
                        }
                    }
                }
                delete this._linkedPrograms;
            }

            var programs = this._programs;
            if (programs) {
                if (gl) {
                    for (p in programs) {
                        if (programs.hasOwnProperty(p)) {
                            gl.deleteShader(programs[p]);
                        }
                    }
                }
                delete this._programs;
            }

            delete this._samplers;
            delete this._parameters;
            delete this._gd;
        }
    };

    TZWebGLShader.create = function (gd, params, onload) {
        var gl = gd._gl;

        var shader = new TZWebGLShader();

        shader._initialized = false;

        var techniques = params.techniques;
        var parameters = params.parameters;
        var programs = params.programs;
        var samplers = params.samplers;
        var p;

        shader._gd = gd;
        shader.name = params.name;

        // Compile programs as early as possible
        var shaderPrograms = {};
        shader._programs = shaderPrograms;
        for (p in programs) {
            if (programs.hasOwnProperty(p)) {
                var program = programs[p];

                var glShaderType;
                if (program.type === 'fragment') {
                    glShaderType = gl.FRAGMENT_SHADER;
                } else if (program.type === 'vertex') {
                    glShaderType = gl.VERTEX_SHADER;
                }
                var glShader = gl.createShader(glShaderType);

                var code = program.code;

                if (gd._fixIE && gd._fixIE < "0.93") {
                    code = code.replace(/#.*\n/g, '');
                    code = code.replace(/TZ_LOWP/g, '');
                    if (-1 !== code.indexOf('texture2DProj')) {
                        code = 'vec4 texture2DProj(sampler2D s, vec3 uv){ return texture2D(s, uv.xy / uv.z);}\n' + code;
                    }
                }

                gl.shaderSource(glShader, code);

                gl.compileShader(glShader);

                shaderPrograms[p] = glShader;
            }
        }

        var linkedPrograms = {};
        shader._linkedPrograms = linkedPrograms;

        // Samplers
        var defaultSampler = gd.DEFAULT_SAMPLER;
        var maxAnisotropy = gd._maxAnisotropy;

        shader._samplers = {};
        for (p in samplers) {
            if (samplers.hasOwnProperty(p)) {
                var fileSampler = samplers[p];

                var samplerMaxAnisotropy = fileSampler.MaxAnisotropy;
                if (samplerMaxAnisotropy) {
                    if (samplerMaxAnisotropy > maxAnisotropy) {
                        samplerMaxAnisotropy = maxAnisotropy;
                    }
                } else {
                    samplerMaxAnisotropy = defaultSampler.maxAnisotropy;
                }

                var sampler = {
                    minFilter: (fileSampler.MinFilter || defaultSampler.minFilter),
                    magFilter: (fileSampler.MagFilter || defaultSampler.magFilter),
                    wrapS: (fileSampler.WrapS || defaultSampler.wrapS),
                    wrapT: (fileSampler.WrapT || defaultSampler.wrapT),
                    wrapR: (fileSampler.WrapR || defaultSampler.wrapR),
                    maxAnisotropy: samplerMaxAnisotropy
                };
                if (sampler.wrapS === 0x2900) {
                    sampler.wrapS = gl.CLAMP_TO_EDGE;
                }
                if (sampler.wrapT === 0x2900) {
                    sampler.wrapT = gl.CLAMP_TO_EDGE;
                }
                if (sampler.wrapR === 0x2900) {
                    sampler.wrapR = gl.CLAMP_TO_EDGE;
                }
                shader._samplers[p] = gd._createSampler(sampler);
            }
        }

        // Parameters
        var numParameters = 0;
        shader._parameters = {};
        for (p in parameters) {
            if (parameters.hasOwnProperty(p)) {
                // We add the extra properties to the ShaderParameter
                // to make it a WebGLShaderParameter.
                var parameter = parameters[p];
                if (!parameter.columns) {
                    parameter.columns = 1;
                }
                if (!parameter.rows) {
                    parameter.rows = 1;
                }
                parameter.numValues = (parameter.columns * parameter.rows);
                var parameterType = parameter.type;
                if (parameterType === "float" || parameterType === "int" || parameterType === "bool") {
                    var parameterValues = parameter.values;
                    if (parameterValues) {
                        if (parameterType === "float") {
                            parameter.values = new Float32Array(parameterValues);
                        } else {
                            parameter.values = new Int32Array(parameterValues);
                        }
                    } else {
                        if (parameterType === "float") {
                            parameter.values = new Float32Array(parameter.numValues);
                        } else {
                            parameter.values = new Int32Array(parameter.numValues);
                        }
                    }
                    parameter.sampler = undefined;
                } else {
                    sampler = shader._samplers[p];
                    if (!sampler) {
                        sampler = defaultSampler;
                        shader._samplers[p] = defaultSampler;
                    }
                    parameter.sampler = sampler;
                    parameter.values = null;
                }

                parameter.name = p;

                shader._parameters[p] = parameter;
                numParameters += 1;
            }
        }
        shader.numParameters = numParameters;

        // Techniques and passes
        var shaderTechniques = {};
        var numTechniques = 0;
        var numLoadedTechniques = 0;
        shader._techniques = shaderTechniques;

        function createTechniqueLoader(techniqueName) {
            return function () {
                shaderTechniques[techniqueName] = new WebGLTechnique(gd, shader, techniqueName, techniques[techniqueName]);
                numLoadedTechniques += 1;
                if (numLoadedTechniques >= numTechniques) {
                    onload(shader);
                }
            };
        }

        for (p in techniques) {
            if (techniques.hasOwnProperty(p)) {
                if (onload) {
                    shaderTechniques[p] = null;

                    TurbulenzEngine.setTimeout(createTechniqueLoader(p), 0);
                } else {
                    shaderTechniques[p] = new WebGLTechnique(gd, shader, p, techniques[p]);
                }
                numTechniques += 1;
            }
        }
        shader.numTechniques = numTechniques;

        shader.id = ++gd._counters.shaders;

        return shader;
    };
    TZWebGLShader.version = 1;
    return TZWebGLShader;
})();

//
// WebGLTechniqueParameters
//
var WebGLTechniqueParameters = (function () {
    function WebGLTechniqueParameters(params) {
        if (params) {
            for (var p in params) {
                if (params.hasOwnProperty(p)) {
                    this[p] = params[p];
                }
            }
        }
    }
    WebGLTechniqueParameters.create = function (params) {
        return new WebGLTechniqueParameters(params);
    };
    return WebGLTechniqueParameters;
})();

//
// WebGLTechniqueParameterBuffer
//
// This object type is now shared with native code.  See vmath.ts
//
// WebGLDrawParameters
//
var WebGLDrawParameters = (function () {
    function WebGLDrawParameters() {
        // Streams, TechniqueParameters and Instances are stored as indexed properties
        this.sortKey = 0;
        this._technique = null;
        this._endStreams = 0;
        this._endTechniqueParameters = (16 * 3);
        this._endInstances = ((16 * 3) + 8);
        this.primitive = -1;
        this.count = 0;
        this.firstIndex = 0;
        this.userData = null;

        this._indexBuffer = null;
        this._vao = null;
        this._parametersList = [];

        // Initialize Streams
        var n;
        for (n = 0; n < (16 * 3); n += 3) {
            this[n + 0] = null;
            this[n + 1] = null;
            this[n + 2] = 0;
        }

        // Initialize for 2 TechniqueParameters
        this[(16 * 3) + 0] = null;
        this[(16 * 3) + 1] = null;

        /*
        // Initialize for 8 instances
        this[((16 * 3) + 8) + 0] = undefined;
        this[((16 * 3) + 8) + 1] = undefined;
        this[((16 * 3) + 8) + 2] = undefined;
        this[((16 * 3) + 8) + 3] = undefined;
        this[((16 * 3) + 8) + 4] = undefined;
        this[((16 * 3) + 8) + 5] = undefined;
        this[((16 * 3) + 8) + 6] = undefined;
        this[((16 * 3) + 8) + 7] = undefined;
        */
        return this;
    }
    WebGLDrawParameters.prototype.clone = function (dst) {
        if (!dst) {
            dst = new WebGLDrawParameters();
        }

        dst.sortKey = this.sortKey;
        dst._technique = this._technique;
        dst._endStreams = this._endStreams;
        dst._endTechniqueParameters = this._endTechniqueParameters;
        dst._endInstances = this._endInstances;
        dst.primitive = this.primitive;
        dst.count = this.count;
        dst.firstIndex = this.firstIndex;
        dst.userData = this.userData;

        dst._indexBuffer = this._indexBuffer;
        dst._vao = this._vao;

        var count = this._parametersList.length;
        for (var i = 0; i < count; i += 1) {
            dst._parametersList[i] = this._parametersList[i];
        }
        dst._parametersList.length = count;

        for (i = 0; i < this._endInstances; i += 1) {
            dst[i] = this[i];
        }

        return dst;
    };

    WebGLDrawParameters.prototype._differentParameters = function (oldTP, newTP) {
        var p;

        for (p in oldTP) {
            if (newTP[p] === undefined) {
                return true;
            }
        }

        for (p in newTP) {
            if (oldTP[p] === undefined) {
                return true;
            }
        }

        return false;
    };

    WebGLDrawParameters.prototype.setTechniqueParameters = function (indx, techniqueParameters) {
        debug.assert(indx < 8, "indx out of range");
        if (indx < 8) {
            indx += (16 * 3);

            var oldTechniqueParameters = this[indx];
            if (oldTechniqueParameters !== techniqueParameters) {
                if (!oldTechniqueParameters || !techniqueParameters || this._differentParameters(oldTechniqueParameters, techniqueParameters)) {
                    this._parametersList.length = 0;
                }
                this[indx] = techniqueParameters;
            }

            var endTechniqueParameters = this._endTechniqueParameters;
            if (techniqueParameters) {
                if (endTechniqueParameters <= indx) {
                    this._endTechniqueParameters = (indx + 1);
                }
            } else {
                while ((16 * 3) < endTechniqueParameters && !this[endTechniqueParameters - 1]) {
                    endTechniqueParameters -= 1;
                }
                this._endTechniqueParameters = endTechniqueParameters;
            }
        }
    };

    WebGLDrawParameters.prototype.setVertexBuffer = function (indx, vertexBuffer) {
        debug.assert(indx < 16, "index out of range");
        if (indx < 16) {
            indx *= 3;

            if (this[indx] !== vertexBuffer) {
                this[indx] = vertexBuffer;
                this._vao = null;
            }

            var endStreams = this._endStreams;
            if (vertexBuffer) {
                if (endStreams <= indx) {
                    this._endStreams = (indx + 3);
                }
            } else {
                while (0 < endStreams && !this[endStreams - 3]) {
                    endStreams -= 3;
                }
                this._endStreams = endStreams;
            }
        }
    };

    WebGLDrawParameters.prototype.setSemantics = function (indx, semantics) {
        debug.assert(indx < 16, "index parameter out of range");
        debug.assert(semantics === null || semantics === undefined || semantics instanceof WebGLSemantics, "semantics must be created with GraphicsDevice.createSemantics");

        if (indx < 16) {
            if (this[(indx * 3) + 1] !== semantics) {
                this[(indx * 3) + 1] = semantics;
                this._vao = null;
            }
        }
    };

    WebGLDrawParameters.prototype.setOffset = function (indx, offset) {
        debug.assert(indx < 16, "index parameter out of range");
        if (indx < 16) {
            if (this[(indx * 3) + 2] !== offset) {
                this[(indx * 3) + 2] = offset;
                this._vao = null;
            }
        }
    };

    WebGLDrawParameters.prototype.getTechniqueParameters = function (indx) {
        if (indx < 8) {
            return this[indx + (16 * 3)];
        } else {
            return undefined;
        }
    };

    WebGLDrawParameters.prototype.getVertexBuffer = function (indx) {
        if (indx < 16) {
            return this[(indx * 3) + 0];
        } else {
            return undefined;
        }
    };

    WebGLDrawParameters.prototype.getSemantics = function (indx) {
        if (indx < 16) {
            return this[(indx * 3) + 1];
        } else {
            return undefined;
        }
    };

    WebGLDrawParameters.prototype.getOffset = function (indx) {
        if (indx < 16) {
            return this[(indx * 3) + 2];
        } else {
            return undefined;
        }
    };

    WebGLDrawParameters.prototype.addInstance = function (instanceParameters) {
        if (instanceParameters) {
            var endInstances = this._endInstances;
            this._endInstances = (endInstances + 1);
            this[endInstances] = instanceParameters;
        }
    };

    WebGLDrawParameters.prototype.removeInstances = function () {
        this._endInstances = ((16 * 3) + 8);
    };

    WebGLDrawParameters.prototype.getNumInstances = function () {
        return (this._endInstances - ((16 * 3) + 8));
    };

    WebGLDrawParameters.prototype._buildParametersList = function (passParameters) {
        var parametersList = this._parametersList;
        var endTechniqueParameters = this._endTechniqueParameters;
        var offset = 0;
        var t;
        for (t = (16 * 3); t < endTechniqueParameters; t += 1) {
            var techniqueParameters = this[t];
            if (techniqueParameters) {
                var p;
                for (p in techniqueParameters) {
                    var parameter = passParameters[p];
                    if (parameter !== undefined && techniqueParameters[p] !== undefined) {
                        parametersList[offset] = p;
                        offset += 1;

                        parametersList[offset] = parameter;
                        offset += 1;
                    }
                }
            }
            parametersList[offset] = null;
            offset += 1;
        }
    };

    WebGLDrawParameters.create = function () {
        return new WebGLDrawParameters();
    };
    WebGLDrawParameters.version = 1;
    return WebGLDrawParameters;
})();

Object.defineProperty(WebGLDrawParameters.prototype, "technique", {
    get: function getTechniqueFn() {
        return this._technique;
    },
    set: function setTechniqueFn(technique) {
        if (this._technique !== technique) {
            this._technique = technique;
            this._parametersList.length = 0;
        }
    },
    enumerable: true,
    configurable: false
});

Object.defineProperty(WebGLDrawParameters.prototype, "indexBuffer", {
    get: function getIndexBufferFn() {
        return this._indexBuffer;
    },
    set: function setIndexBufferFn(indexBuffer) {
        if (this._indexBuffer !== indexBuffer) {
            this._indexBuffer = indexBuffer;
            this._vao = null;
        }
    },
    enumerable: true,
    configurable: false
});

;

;

;

;

;

var WebGLGraphicsDevice = (function () {
    function WebGLGraphicsDevice() {
    }
    WebGLGraphicsDevice.prototype.drawIndexed = function (primitive, numIndices, first) {
        var gl = this._gl;
        var indexBuffer = this._activeIndexBuffer;

        var offset;
        if (first) {
            offset = (first * indexBuffer._stride);
        } else {
            offset = 0;
        }

        var format = indexBuffer.format;

        var attributeMask = this._attributeMask;

        var activeTechnique = this._activeTechnique;
        var passes = activeTechnique.passes;
        var numPasses = passes.length;
        var mask;

        if (activeTechnique.checkProperties) {
            activeTechnique.checkProperties(this);
        }

        if (1 === numPasses) {
            /* tslint:disable:no-bitwise */
            mask = (passes[0].semanticsMask & attributeMask);

            /* tslint:enable:no-bitwise */
            if (mask !== this._clientStateMask) {
                this.enableClientState(mask);
            }

            gl.drawElements(primitive, numIndices, format, offset);

            if (debug) {
                this.metrics.addPrimitives(primitive, numIndices);
            }
        } else {
            for (var p = 0; p < numPasses; p += 1) {
                var pass = passes[p];

                /* tslint:disable:no-bitwise */
                mask = (pass.semanticsMask & attributeMask);

                /* tslint:enable:no-bitwise */
                if (mask !== this._clientStateMask) {
                    this.enableClientState(mask);
                }

                this.setPass(pass);

                gl.drawElements(primitive, numIndices, format, offset);

                if (debug) {
                    this.metrics.addPrimitives(primitive, numIndices);
                }
            }
        }
    };

    WebGLGraphicsDevice.prototype.draw = function (primitive, numVertices, first) {
        var gl = this._gl;

        var attributeMask = this._attributeMask;

        var activeTechnique = this._activeTechnique;
        var passes = activeTechnique.passes;
        var numPasses = passes.length;
        var mask;

        if (activeTechnique.checkProperties) {
            activeTechnique.checkProperties(this);
        }

        if (1 === numPasses) {
            /* tslint:disable:no-bitwise */
            mask = (passes[0].semanticsMask & attributeMask);

            /* tslint:enable:no-bitwise */
            if (mask !== this._clientStateMask) {
                this.enableClientState(mask);
            }

            gl.drawArrays(primitive, first, numVertices);

            if (debug) {
                this.metrics.addPrimitives(primitive, numVertices);
            }
        } else {
            for (var p = 0; p < numPasses; p += 1) {
                var pass = passes[p];

                /* tslint:disable:no-bitwise */
                mask = (pass.semanticsMask & attributeMask);

                /* tslint:enable:no-bitwise */
                if (mask !== this._clientStateMask) {
                    this.enableClientState(mask);
                }

                this.setPass(pass);

                gl.drawArrays(primitive, first, numVertices);

                if (debug) {
                    this.metrics.addPrimitives(primitive, numVertices);
                }
            }
        }
    };

    WebGLGraphicsDevice.prototype.setTechniqueParameters = function () {
        var activeTechnique = this._activeTechnique;
        var passes = activeTechnique.passes;
        var numTechniqueParameters = arguments.length;
        var t;
        if (1 === passes.length) {
            var parameters = passes[0].parameters;
            for (t = 0; t < numTechniqueParameters; t += 1) {
                this._setParameters(parameters, arguments[t]);
            }
        } else {
            for (t = 0; t < numTechniqueParameters; t += 1) {
                this._setParametersDeferred(this, passes, arguments[t]);
            }
        }
    };

    //Internal
    WebGLGraphicsDevice.prototype._setUniform4fv = function (location, oldValues, newValues) {
        var numValues = newValues.length;
        var n = 0;
        do {
            if (oldValues[n] !== newValues[n] || oldValues[n + 1] !== newValues[n + 1] || oldValues[n + 2] !== newValues[n + 2] || oldValues[n + 3] !== newValues[n + 3]) {
                do {
                    oldValues[n] = newValues[n];
                    oldValues[n + 1] = newValues[n + 1];
                    oldValues[n + 2] = newValues[n + 2];
                    oldValues[n + 3] = newValues[n + 3];
                    n += 4;
                } while(n < numValues);

                this._gl.uniform4fv(location, newValues);

                if (debug) {
                    this.metrics.techniqueParametersChanges += 1;
                }

                break;
            }
            n += 4;
        } while(n < numValues);
    };

    WebGLGraphicsDevice.prototype._setUniform3fv = function (location, oldValues, newValues) {
        var numValues = newValues.length;
        var n = 0;
        do {
            if (oldValues[n] !== newValues[n] || oldValues[n + 1] !== newValues[n + 1] || oldValues[n + 2] !== newValues[n + 2]) {
                do {
                    oldValues[n] = newValues[n];
                    oldValues[n + 1] = newValues[n + 1];
                    oldValues[n + 2] = newValues[n + 2];
                    n += 3;
                } while(n < numValues);

                this._gl.uniform3fv(location, newValues);

                if (debug) {
                    this.metrics.techniqueParametersChanges += 1;
                }

                break;
            }
            n += 3;
        } while(n < numValues);
    };

    WebGLGraphicsDevice.prototype._setUniform2fv = function (location, oldValues, newValues) {
        var numValues = newValues.length;
        var n = 0;
        do {
            if (oldValues[n] !== newValues[n] || oldValues[n + 1] !== newValues[n + 1]) {
                do {
                    oldValues[n] = newValues[n];
                    oldValues[n + 1] = newValues[n + 1];
                    n += 2;
                } while(n < numValues);

                this._gl.uniform2fv(location, newValues);

                if (debug) {
                    this.metrics.techniqueParametersChanges += 1;
                }

                break;
            }
            n += 2;
        } while(n < numValues);
    };

    WebGLGraphicsDevice.prototype._setUniform1fv = function (location, oldValues, newValues) {
        var numValues = newValues.length;
        var n = 0;
        do {
            if (oldValues[n] !== newValues[n]) {
                do {
                    oldValues[n] = newValues[n];
                    n += 1;
                } while(n < numValues);

                this._gl.uniform1fv(location, newValues);

                if (debug) {
                    this.metrics.techniqueParametersChanges += 1;
                }

                break;
            }
            n += 1;
        } while(n < numValues);
    };

    WebGLGraphicsDevice.prototype._setUniform1f = function (parameter, newValue) {
        if (Math.abs(parameter.values - newValue) >= 1e-6) {
            // Copy new value
            parameter.values = newValue;

            this._gl.uniform1f(parameter.location, newValue);

            if (debug) {
                this.metrics.techniqueParametersChanges += 1;
            }
        }
    };

    WebGLGraphicsDevice.prototype._setUniform4iv = function (location, oldValues, newValues) {
        var numValues = newValues.length;
        var n = 0;
        do {
            if (oldValues[n] !== newValues[n] || oldValues[n + 1] !== newValues[n + 1] || oldValues[n + 2] !== newValues[n + 2] || oldValues[n + 3] !== newValues[n + 3]) {
                do {
                    oldValues[n] = newValues[n];
                    oldValues[n + 1] = newValues[n + 1];
                    oldValues[n + 2] = newValues[n + 2];
                    oldValues[n + 3] = newValues[n + 3];
                    n += 4;
                } while(n < numValues);

                this._gl.uniform4iv(location, newValues);

                if (debug) {
                    this.metrics.techniqueParametersChanges += 1;
                }

                break;
            }
            n += 4;
        } while(n < numValues);
    };

    WebGLGraphicsDevice.prototype._setUniform3iv = function (location, oldValues, newValues) {
        var numValues = newValues.length;
        var n = 0;
        do {
            if (oldValues[n] !== newValues[n] || oldValues[n + 1] !== newValues[n + 1] || oldValues[n + 2] !== newValues[n + 2]) {
                do {
                    oldValues[n] = newValues[n];
                    oldValues[n + 1] = newValues[n + 1];
                    oldValues[n + 2] = newValues[n + 2];
                    n += 3;
                } while(n < numValues);

                this._gl.uniform3iv(location, newValues);

                if (debug) {
                    this.metrics.techniqueParametersChanges += 1;
                }

                break;
            }
            n += 3;
        } while(n < numValues);
    };

    WebGLGraphicsDevice.prototype._setUniform2iv = function (location, oldValues, newValues) {
        var numValues = newValues.length;
        var n = 0;
        do {
            if (oldValues[n] !== newValues[n] || oldValues[n + 1] !== newValues[n + 1]) {
                do {
                    oldValues[n] = newValues[n];
                    oldValues[n + 1] = newValues[n + 1];
                    n += 2;
                } while(n < numValues);

                this._gl.uniform2iv(location, newValues);

                if (debug) {
                    this.metrics.techniqueParametersChanges += 1;
                }

                break;
            }
            n += 2;
        } while(n < numValues);
    };

    WebGLGraphicsDevice.prototype._setUniform1iv = function (location, oldValues, newValues) {
        var numValues = newValues.length;
        var n = 0;
        do {
            if (oldValues[n] !== newValues[n]) {
                do {
                    oldValues[n] = newValues[n];
                    n += 1;
                } while(n < numValues);

                this._gl.uniform1iv(location, newValues);

                if (debug) {
                    this.metrics.techniqueParametersChanges += 1;
                }

                break;
            }
            n += 1;
        } while(n < numValues);
    };

    WebGLGraphicsDevice.prototype._setUniform1i = function (parameter, newValue) {
        if (parameter.values !== newValue) {
            // Copy new value
            parameter.values = newValue;

            this._gl.uniform1i(parameter.location, newValue);

            if (debug) {
                this.metrics.techniqueParametersChanges += 1;
            }
        }
    };

    WebGLGraphicsDevice.prototype._setParameters = function (parameters, techniqueParameters) {
        for (var p in techniqueParameters) {
            var parameter = parameters[p];
            if (parameter !== undefined) {
                var parameterValues = techniqueParameters[p];
                if (parameterValues !== undefined) {
                    var paramInfo = parameter.info;
                    var numColumns;
                    if (paramInfo.type === 'float') {
                        numColumns = paramInfo.columns;
                        if (4 === numColumns) {
                            this._setUniform4fv(parameter.location, parameter.values, parameterValues);
                        } else if (3 === numColumns) {
                            this._setUniform3fv(parameter.location, parameter.values, parameterValues);
                        } else if (2 === numColumns) {
                            this._setUniform2fv(parameter.location, parameter.values, parameterValues);
                        } else if (1 === paramInfo.rows) {
                            this._setUniform1f(parameter, parameterValues);
                        } else {
                            this._setUniform1fv(parameter.location, parameter.values, parameterValues);
                        }
                    } else if (paramInfo.sampler !== undefined) {
                        this._setTexture(parameter.textureUnit, parameterValues, paramInfo.sampler);
                    } else {
                        numColumns = paramInfo.columns;
                        if (4 === numColumns) {
                            this._setUniform4iv(parameter.location, parameter.values, parameterValues);
                        } else if (3 === numColumns) {
                            this._setUniform3iv(parameter.location, parameter.values, parameterValues);
                        } else if (2 === numColumns) {
                            this._setUniform2iv(parameter.location, parameter.values, parameterValues);
                        } else if (1 === paramInfo.rows) {
                            this._setUniform1i(parameter, parameterValues);
                        } else {
                            this._setUniform1iv(parameter.location, parameter.values, parameterValues);
                        }
                    }
                } else {
                    delete techniqueParameters[p];
                }
            }
        }
    };

    // ONLY USE FOR SINGLE PASS TECHNIQUES ON DRAWARRAY
    WebGLGraphicsDevice.prototype._setParametersArray = function (parameters, techniqueParametersArray, numTechniqueParameters) {
        var n;
        for (n = 0; n < numTechniqueParameters; n += 2) {
            var p = techniqueParametersArray[n];
            var parameter = parameters[p];
            if (parameter !== undefined) {
                var parameterValues = techniqueParametersArray[n + 1];

                if (parameter.current !== parameterValues) {
                    parameter.current = parameterValues;

                    var paramInfo = parameter.info;
                    var numColumns;
                    if (paramInfo.type === 'float') {
                        numColumns = paramInfo.columns;
                        if (4 === numColumns) {
                            this._setUniform4fv(parameter.location, parameter.values, parameterValues);
                        } else if (3 === numColumns) {
                            this._setUniform3fv(parameter.location, parameter.values, parameterValues);
                        } else if (2 === numColumns) {
                            this._setUniform2fv(parameter.location, parameter.values, parameterValues);
                        } else if (1 === paramInfo.rows) {
                            this._setUniform1f(parameter, parameterValues);
                        } else {
                            this._setUniform1fv(parameter.location, parameter.values, parameterValues);
                        }
                    } else if (paramInfo.sampler !== undefined) {
                        this._setTexture(parameter.textureUnit, parameterValues, paramInfo.sampler);
                    } else {
                        numColumns = paramInfo.columns;
                        if (4 === numColumns) {
                            this._setUniform4iv(parameter.location, parameter.values, parameterValues);
                        } else if (3 === numColumns) {
                            this._setUniform3iv(parameter.location, parameter.values, parameterValues);
                        } else if (2 === numColumns) {
                            this._setUniform2iv(parameter.location, parameter.values, parameterValues);
                        } else if (1 === paramInfo.rows) {
                            this._setUniform1i(parameter, parameterValues);
                        } else {
                            this._setUniform1iv(parameter.location, parameter.values, parameterValues);
                        }
                    }
                }
            }
        }
    };

    WebGLGraphicsDevice.prototype._setParametersList = function (techniqueParameters, parametersList, offset) {
        var p = parametersList[offset];
        offset += 1;

        while (p !== null) {
            var parameter = parametersList[offset];
            offset += 1;

            var parameterValues = techniqueParameters[p];
            if (parameter.current !== parameterValues) {
                parameter.current = parameterValues;

                var paramInfo = parameter.info;
                var numColumns;
                if (paramInfo.type === 'float') {
                    numColumns = paramInfo.columns;
                    if (4 === numColumns) {
                        this._setUniform4fv(parameter.location, parameter.values, parameterValues);
                    } else if (3 === numColumns) {
                        this._setUniform3fv(parameter.location, parameter.values, parameterValues);
                    } else if (2 === numColumns) {
                        this._setUniform2fv(parameter.location, parameter.values, parameterValues);
                    } else if (1 === paramInfo.rows) {
                        this._setUniform1f(parameter, parameterValues);
                    } else {
                        this._setUniform1fv(parameter.location, parameter.values, parameterValues);
                    }
                } else if (paramInfo.sampler !== undefined) {
                    this._setTexture(parameter.textureUnit, parameterValues, paramInfo.sampler);
                } else {
                    numColumns = paramInfo.columns;
                    if (4 === numColumns) {
                        this._setUniform4iv(parameter.location, parameter.values, parameterValues);
                    } else if (3 === numColumns) {
                        this._setUniform3iv(parameter.location, parameter.values, parameterValues);
                    } else if (2 === numColumns) {
                        this._setUniform2iv(parameter.location, parameter.values, parameterValues);
                    } else if (1 === paramInfo.rows) {
                        this._setUniform1i(parameter, parameterValues);
                    } else {
                        this._setUniform1iv(parameter.location, parameter.values, parameterValues);
                    }
                }
            }

            p = parametersList[offset];
            offset += 1;
        }

        return offset;
    };

    // ONLY USE FOR SINGLE PASS TECHNIQUES ON DRAWARRAYMULTIPASS
    WebGLGraphicsDevice.prototype._setParametersMultiPass = function (gd, passes, techniqueParameters) {
        gd._setParameters(passes[0].parameters, techniqueParameters);
    };

    WebGLGraphicsDevice.prototype._setParametersDeferred = function (gd, passes, techniqueParameters) {
        var numPasses = passes.length;
        var min = Math.min;
        var max = Math.max;
        for (var n = 0; n < numPasses; n += 1) {
            var pass = passes[n];
            var parameters = pass.parameters;
            pass.dirty = true;

            for (var p in techniqueParameters) {
                var parameter = parameters[p];
                if (parameter) {
                    var parameterValues = techniqueParameters[p];
                    if (parameterValues !== undefined) {
                        var paramInfo = parameter.info;
                        if (paramInfo.sampler) {
                            paramInfo.values = parameterValues;
                            parameter.dirty = 1;
                        } else if (typeof parameterValues !== 'number') {
                            var values = paramInfo.values;
                            var numValues = min(paramInfo.numValues, parameterValues.length);
                            for (var v = 0; v < numValues; v += 1) {
                                values[v] = parameterValues[v];
                            }
                            parameter.dirty = max(numValues, (parameter.dirty || 0));
                        } else {
                            paramInfo.values[0] = parameterValues;
                            parameter.dirty = (parameter.dirty || 1);
                        }
                    } else {
                        delete techniqueParameters[p];
                    }
                }
            }
        }
    };

    WebGLGraphicsDevice.prototype.setTechnique = function (technique) {
        debug.assert(technique instanceof WebGLTechnique, "argument must be a Technique");

        var activeTechnique = this._activeTechnique;
        if (activeTechnique !== technique) {
            if (activeTechnique) {
                activeTechnique.deactivate();
            }

            this._activeTechnique = technique;

            technique.activate(this);

            var passes = technique.passes;
            if (1 === passes.length) {
                this.setPass(passes[0]);
            }
        }
    };

    // ONLY USE FOR SINGLE PASS TECHNIQUES ON DRAWARRAY
    WebGLGraphicsDevice.prototype._setTechnique = function (technique) {
        var pass = technique.passes[0];

        var activeTechnique = this._activeTechnique;
        if (activeTechnique !== technique) {
            if (activeTechnique) {
                activeTechnique.deactivate();
            }

            this._activeTechnique = technique;

            technique.activate(this);

            this.setPass(pass);
        }

        var parameters = pass.parametersArray;
        var numParameters = parameters.length;
        var n;
        for (n = 0; n < numParameters; n += 1) {
            parameters[n].current = parameters[n].values;
        }
    };

    WebGLGraphicsDevice.prototype.setStream = function (vertexBuffer, semantics, offset) {
        if (debug) {
            debug.assert(vertexBuffer instanceof WebGLVertexBuffer);
            debug.assert(semantics instanceof WebGLSemantics);
        }

        if (offset) {
            offset *= vertexBuffer._strideInBytes;
        } else {
            offset = 0;
        }

        this.bindVertexBuffer(vertexBuffer._glBuffer);

        /* tslint:disable:no-bitwise */
        this._attributeMask |= vertexBuffer.bindAttributesCached(semantics, offset);
        /* tslint:enable:no-bitwise */
    };

    WebGLGraphicsDevice.prototype.setIndexBuffer = function (indexBuffer) {
        if (this._activeIndexBuffer !== indexBuffer) {
            this._activeIndexBuffer = indexBuffer;
            var glBuffer;
            if (indexBuffer) {
                glBuffer = indexBuffer._glBuffer;
            } else {
                glBuffer = null;
            }
            var gl = this._gl;
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glBuffer);

            if (debug) {
                this.metrics.indexBufferChanges += 1;
            }
        }
    };

    // This version only support technique with a single pass, but it is faster
    WebGLGraphicsDevice.prototype.drawArray = function (drawParametersArray, globalTechniqueParametersArray, sortMode) {
        var gl = this._gl;
        var ELEMENT_ARRAY_BUFFER = gl.ELEMENT_ARRAY_BUFFER;

        var numDrawParameters = drawParametersArray.length;
        if (numDrawParameters > 1 && sortMode) {
            if (sortMode > 0) {
                drawParametersArray.sort(this._drawArraySortPositive);
            } else {
                drawParametersArray.sort(this._drawArraySortNegative);
            }
        }

        var globalsArray = this._techniqueParametersArray;
        var numGlobalParameters = this._createTechniqueParametersArray(globalTechniqueParametersArray, globalsArray);

        var activeIndexBuffer = this._activeIndexBuffer;
        var attributeMask = this._attributeMask;
        var lastTechnique = null;
        var lastEndStreams = -1;
        var lastDrawParameters = null;
        var v = 0;
        var streamsMatch = false;
        var vertexBuffer = null;
        var pass = null;
        var passParameters = null;
        var indexFormat = 0;
        var indexStride = 0;
        var mask = 0;
        var t = 0;
        var offset = 0;

        if (activeIndexBuffer) {
            indexFormat = activeIndexBuffer.format;
            indexStride = activeIndexBuffer._stride;
        }

        for (var n = 0; n < numDrawParameters; n += 1) {
            var drawParameters = drawParametersArray[n];
            var technique = drawParameters._technique;
            var endTechniqueParameters = drawParameters._endTechniqueParameters;
            var endStreams = drawParameters._endStreams;
            var endInstances = drawParameters._endInstances;
            var indexBuffer = drawParameters._indexBuffer;
            var primitive = drawParameters.primitive;
            var count = drawParameters.count;
            var firstIndex = drawParameters.firstIndex;

            if (lastTechnique !== technique) {
                lastTechnique = technique;

                this._setTechnique(technique);

                pass = technique.passes[0];
                passParameters = pass.parameters;

                /* tslint:disable:no-bitwise */
                mask = (pass.semanticsMask & attributeMask);

                /* tslint:enable:no-bitwise */
                if (mask !== this._clientStateMask) {
                    this.enableClientState(mask);
                }

                if (technique.checkProperties) {
                    technique.checkProperties(this);
                }

                this._setParametersArray(passParameters, globalsArray, numGlobalParameters);
            }

            var parametersList = drawParameters._parametersList;
            if (parametersList.length === 0) {
                drawParameters._buildParametersList(passParameters);
            }

            offset = 0;
            for (t = (16 * 3); t < endTechniqueParameters; t += 1) {
                offset = this._setParametersList(drawParameters[t], parametersList, offset);
            }

            streamsMatch = (lastEndStreams === endStreams);
            for (v = 0; streamsMatch && v < endStreams; v += 3) {
                streamsMatch = (lastDrawParameters[v] === drawParameters[v] && lastDrawParameters[v + 1] === drawParameters[v + 1] && lastDrawParameters[v + 2] === drawParameters[v + 2]);
            }

            if (!streamsMatch) {
                lastEndStreams = endStreams;

                for (v = 0; v < endStreams; v += 3) {
                    vertexBuffer = drawParameters[v];
                    if (vertexBuffer) {
                        this.setStream(vertexBuffer, drawParameters[v + 1], drawParameters[v + 2]);
                    }
                }

                attributeMask = this._attributeMask;

                /* tslint:disable:no-bitwise */
                mask = (pass.semanticsMask & attributeMask);

                /* tslint:enable:no-bitwise */
                if (mask !== this._clientStateMask) {
                    this.enableClientState(mask);
                }
            }

            lastDrawParameters = drawParameters;

            /* tslint:disable:no-bitwise */
            if (indexBuffer) {
                if (activeIndexBuffer !== indexBuffer) {
                    activeIndexBuffer = indexBuffer;
                    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, indexBuffer._glBuffer);

                    indexFormat = indexBuffer.format;
                    indexStride = indexBuffer._stride;

                    if (debug) {
                        this.metrics.indexBufferChanges += 1;
                    }
                }

                firstIndex *= indexStride;

                t = ((16 * 3) + 8);
                if (t < endInstances) {
                    do {
                        this._setParameters(passParameters, drawParameters[t]);

                        gl.drawElements(primitive, count, indexFormat, firstIndex);

                        if (debug) {
                            this.metrics.addPrimitives(primitive, count);
                        }

                        t += 1;
                    } while(t < endInstances);
                } else {
                    gl.drawElements(primitive, count, indexFormat, firstIndex);

                    if (debug) {
                        this.metrics.addPrimitives(primitive, count);
                    }
                }
            } else {
                t = ((16 * 3) + 8);
                if (t < endInstances) {
                    do {
                        this._setParameters(passParameters, drawParameters[t]);

                        gl.drawArrays(primitive, firstIndex, count);

                        if (debug) {
                            this.metrics.addPrimitives(primitive, count);
                        }

                        t += 1;
                    } while(t < endInstances);
                } else {
                    gl.drawArrays(primitive, firstIndex, count);

                    if (debug) {
                        this.metrics.addPrimitives(primitive, count);
                    }
                }
            }
            /* tslint:enable:no-bitwise */
        }

        this._activeIndexBuffer = activeIndexBuffer;
    };

    WebGLGraphicsDevice.prototype.drawArrayVAO = function (drawParametersArray, globalTechniqueParametersArray, sortMode) {
        var gl = this._gl;

        var numDrawParameters = drawParametersArray.length;
        if (numDrawParameters === 0) {
            return;
        }

        if (numDrawParameters > 1 && sortMode) {
            if (sortMode > 0) {
                drawParametersArray.sort(this._drawArraySortPositive);
            } else {
                drawParametersArray.sort(this._drawArraySortNegative);
            }
        }

        var globalsArray = this._techniqueParametersArray;
        var numGlobalParameters = this._createTechniqueParametersArray(globalTechniqueParametersArray, globalsArray);

        var vertexArrayObjectExtension = this._vertexArrayObjectExtension;

        var lastTechnique = null;
        var lastVAO = null;
        var pass = null;
        var passParameters = null;
        var indexFormat = 0;
        var indexStride = 0;
        var offset = 0;
        var t = 0;

        for (var n = 0; n < numDrawParameters; n += 1) {
            var drawParameters = drawParametersArray[n];
            var technique = drawParameters._technique;
            var endTechniqueParameters = drawParameters._endTechniqueParameters;
            var endInstances = drawParameters._endInstances;
            var indexBuffer = drawParameters._indexBuffer;
            var primitive = drawParameters.primitive;
            var count = drawParameters.count;
            var firstIndex = drawParameters.firstIndex;

            if (lastTechnique !== technique) {
                lastTechnique = technique;

                this._setTechnique(technique);

                pass = technique.passes[0];
                passParameters = pass.parameters;

                if (technique.checkProperties) {
                    technique.checkProperties(this);
                }

                this._setParametersArray(passParameters, globalsArray, numGlobalParameters);
            }

            var parametersList = drawParameters._parametersList;
            if (parametersList.length === 0) {
                drawParameters._buildParametersList(passParameters);
            }

            offset = 0;
            for (t = (16 * 3); t < endTechniqueParameters; t += 1) {
                offset = this._setParametersList(drawParameters[t], parametersList, offset);
            }

            var vao = drawParameters._vao;
            if (!vao) {
                vao = this._createVAO(drawParameters);
            }

            if (lastVAO !== vao) {
                lastVAO = vao;

                vertexArrayObjectExtension.bindVertexArrayOES(vao);

                if (indexBuffer) {
                    indexFormat = indexBuffer.format;
                    indexStride = indexBuffer._stride;
                }

                if (debug) {
                    this.metrics.vertexArrayObjectChanges += 1;
                }
            }

            /* tslint:disable:no-bitwise */
            if (indexBuffer) {
                firstIndex *= indexStride;

                t = ((16 * 3) + 8);
                if (t < endInstances) {
                    do {
                        this._setParameters(passParameters, drawParameters[t]);

                        gl.drawElements(primitive, count, indexFormat, firstIndex);

                        if (debug) {
                            this.metrics.addPrimitives(primitive, count);
                        }

                        t += 1;
                    } while(t < endInstances);
                } else {
                    gl.drawElements(primitive, count, indexFormat, firstIndex);

                    if (debug) {
                        this.metrics.addPrimitives(primitive, count);
                    }
                }
            } else {
                t = ((16 * 3) + 8);
                if (t < endInstances) {
                    do {
                        this._setParameters(passParameters, drawParameters[t]);

                        gl.drawArrays(primitive, firstIndex, count);

                        if (debug) {
                            this.metrics.addPrimitives(primitive, count);
                        }

                        t += 1;
                    } while(t < endInstances);
                } else {
                    gl.drawArrays(primitive, firstIndex, count);

                    if (debug) {
                        this.metrics.addPrimitives(primitive, count);
                    }
                }
            }
            /* tslint:enable:no-bitwise */
        }

        vertexArrayObjectExtension.bindVertexArrayOES(null);

        // Reset vertex state
        this._activeIndexBuffer = null;
        this._bindedVertexBuffer = null;
        this._clientStateMask = 0xffff;
        this._attributeMask = 0;
        this.enableClientState(0);

        var semanticsOffsets = this._semanticsOffsets;
        for (n = 0; n < 16; n += 1) {
            semanticsOffsets[n].vertexBuffer = null;
        }
    };

    WebGLGraphicsDevice.prototype._createVAO = function (drawParameters) {
        var endStreams = drawParameters._endStreams;
        var indexBuffer = drawParameters._indexBuffer;
        var id = (indexBuffer ? indexBuffer.id : 0);
        var vaoArray = this._cachedVAOs[id];
        var vaoItem;
        var v;
        if (vaoArray) {
            var numVAOs = vaoArray.length;
            var n, vaoMatch;

            for (n = 0; n < numVAOs; n += 1) {
                vaoItem = vaoArray[n];

                vaoMatch = (vaoItem.endStreams === endStreams);
                for (v = 0; vaoMatch && v < endStreams; v += 3) {
                    vaoMatch = (vaoItem[v] === drawParameters[v] && vaoItem[v + 1] === drawParameters[v + 1] && vaoItem[v + 2] === drawParameters[v + 2]);
                }

                if (vaoMatch) {
                    drawParameters._vao = vaoItem.vao;
                    return vaoItem.vao;
                }
            }
        } else {
            this._cachedVAOs[id] = vaoArray = [];
        }

        var gl = this._gl;

        var vao = this._vertexArrayObjectExtension.createVertexArrayOES();

        this._vertexArrayObjectExtension.bindVertexArrayOES(vao);

        var attributeMask = 0;
        for (v = 0; v < endStreams; v += 3) {
            var vertexBuffer = drawParameters[v];
            if (vertexBuffer) {
                var semantics = drawParameters[v + 1];

                var offset = drawParameters[v + 2];
                if (offset) {
                    offset *= vertexBuffer._strideInBytes;
                } else {
                    offset = 0;
                }

                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer._glBuffer);

                /* tslint:disable:no-bitwise */
                attributeMask |= vertexBuffer.bindAttributes(semantics, offset);

                /* tslint:enable:no-bitwise */
                if (debug) {
                    this.metrics.vertexBufferChanges += 1;
                }
            }
        }

        if (indexBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer._glBuffer);

            if (debug) {
                this.metrics.indexBufferChanges += 1;
            }
        }

        /* tslint:disable:no-bitwise */
        this._clientStateMask = (~attributeMask) & 0xffff;

        /* tslint:enable:no-bitwise */
        this.enableClientState(attributeMask);

        vaoItem = {
            endStreams: endStreams,
            vao: vao
        };

        for (v = 0; v < endStreams; v += 3) {
            vaoItem[v] = drawParameters[v];
            vaoItem[v + 1] = drawParameters[v + 1];
            vaoItem[v + 2] = drawParameters[v + 2];
        }

        vaoArray.push(vaoItem);

        drawParameters._vao = vao;
        return vao;
    };

    // This version suports technique with multiple passes but it is slower
    WebGLGraphicsDevice.prototype.drawArrayMultiPass = function (drawParametersArray, globalTechniqueParametersArray, sortMode) {
        var gl = this._gl;
        var ELEMENT_ARRAY_BUFFER = gl.ELEMENT_ARRAY_BUFFER;

        var setParametersImmediate = this._setParametersMultiPass;
        var setParametersDeferred = this._setParametersDeferred;

        var numGlobalTechniqueParameters = globalTechniqueParametersArray.length;

        var numDrawParameters = drawParametersArray.length;
        if (numDrawParameters > 1 && sortMode) {
            if (sortMode > 0) {
                drawParametersArray.sort(this._drawArraySortPositive);
            } else {
                drawParametersArray.sort(this._drawArraySortNegative);
            }
        }

        var activeIndexBuffer = this._activeIndexBuffer;
        var attributeMask = this._attributeMask;
        var setParameters = null;
        var lastTechnique = null;
        var lastEndStreams = -1;
        var lastDrawParameters = null;
        var techniqueParameters = null;
        var v = 0;
        var streamsMatch = false;
        var vertexBuffer = null;
        var passes = null;
        var p = null;
        var pass = null;
        var indexFormat = 0;
        var indexStride = 0;
        var numPasses = 0;
        var mask = 0;
        var t = 0;

        if (activeIndexBuffer) {
            indexFormat = activeIndexBuffer.format;
            indexStride = activeIndexBuffer._stride;
        }

        for (var n = 0; n < numDrawParameters; n += 1) {
            var drawParameters = (drawParametersArray[n]);
            var technique = drawParameters._technique;
            var endTechniqueParameters = drawParameters._endTechniqueParameters;
            var endStreams = drawParameters._endStreams;
            var endInstances = drawParameters._endInstances;
            var indexBuffer = drawParameters._indexBuffer;
            var primitive = drawParameters.primitive;
            var count = drawParameters.count;
            var firstIndex = drawParameters.firstIndex;

            if (lastTechnique !== technique) {
                lastTechnique = technique;

                passes = technique.passes;
                numPasses = passes.length;
                if (1 === numPasses) {
                    this._setTechnique(technique);
                    setParameters = setParametersImmediate;

                    /* tslint:disable:no-bitwise */
                    mask = (passes[0].semanticsMask & attributeMask);

                    /* tslint:enable:no-bitwise */
                    if (mask !== this._clientStateMask) {
                        this.enableClientState(mask);
                    }
                } else {
                    this.setTechnique(technique);
                    setParameters = setParametersDeferred;
                }

                if (technique.checkProperties) {
                    technique.checkProperties(this);
                }

                for (t = 0; t < numGlobalTechniqueParameters; t += 1) {
                    setParameters(this, passes, globalTechniqueParametersArray[t]);
                }
            }

            for (t = (16 * 3); t < endTechniqueParameters; t += 1) {
                techniqueParameters = drawParameters[t];
                if (techniqueParameters) {
                    setParameters(this, passes, techniqueParameters);
                }
            }

            streamsMatch = (lastEndStreams === endStreams);
            for (v = 0; streamsMatch && v < endStreams; v += 3) {
                streamsMatch = (lastDrawParameters[v] === drawParameters[v] && lastDrawParameters[v + 1] === drawParameters[v + 1] && lastDrawParameters[v + 2] === drawParameters[v + 2]);
            }

            if (!streamsMatch) {
                lastEndStreams = endStreams;

                for (v = 0; v < endStreams; v += 3) {
                    vertexBuffer = drawParameters[v];
                    if (vertexBuffer) {
                        this.setStream(vertexBuffer, drawParameters[v + 1], drawParameters[v + 2]);
                    }
                }

                attributeMask = this._attributeMask;
                if (1 === numPasses) {
                    /* tslint:disable:no-bitwise */
                    mask = (passes[0].semanticsMask & attributeMask);

                    /* tslint:enable:no-bitwise */
                    if (mask !== this._clientStateMask) {
                        this.enableClientState(mask);
                    }
                }
            }

            lastDrawParameters = drawParameters;

            /* tslint:disable:no-bitwise */
            if (indexBuffer) {
                if (activeIndexBuffer !== indexBuffer) {
                    activeIndexBuffer = indexBuffer;
                    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, indexBuffer._glBuffer);

                    indexFormat = indexBuffer.format;
                    indexStride = indexBuffer._stride;

                    if (debug) {
                        this.metrics.indexBufferChanges += 1;
                    }
                }

                firstIndex *= indexStride;

                if (1 === numPasses) {
                    t = ((16 * 3) + 8);
                    if (t < endInstances) {
                        do {
                            setParameters(this, passes, drawParameters[t]);

                            gl.drawElements(primitive, count, indexFormat, firstIndex);

                            if (debug) {
                                this.metrics.addPrimitives(primitive, count);
                            }

                            t += 1;
                        } while(t < endInstances);
                    } else {
                        gl.drawElements(primitive, count, indexFormat, firstIndex);

                        if (debug) {
                            this.metrics.addPrimitives(primitive, count);
                        }
                    }
                } else {
                    t = ((16 * 3) + 8);
                    if (t < endInstances) {
                        do {
                            setParameters(this, passes, drawParameters[t]);

                            for (p = 0; p < numPasses; p += 1) {
                                pass = passes[p];

                                mask = (pass.semanticsMask & attributeMask);
                                if (mask !== this._clientStateMask) {
                                    this.enableClientState(mask);
                                }

                                this.setPass(pass);

                                gl.drawElements(primitive, count, indexFormat, firstIndex);

                                if (debug) {
                                    this.metrics.addPrimitives(primitive, count);
                                }
                            }

                            t += 1;
                        } while(t < endInstances);
                    } else {
                        for (p = 0; p < numPasses; p += 1) {
                            pass = passes[p];

                            mask = (pass.semanticsMask & attributeMask);
                            if (mask !== this._clientStateMask) {
                                this.enableClientState(mask);
                            }

                            this.setPass(pass);

                            gl.drawElements(primitive, count, indexFormat, firstIndex);

                            if (debug) {
                                this.metrics.addPrimitives(primitive, count);
                            }
                        }
                    }
                }
            } else {
                if (1 === numPasses) {
                    t = ((16 * 3) + 8);
                    if (t < endInstances) {
                        do {
                            setParameters(this, passes, drawParameters[t]);

                            gl.drawArrays(primitive, firstIndex, count);

                            if (debug) {
                                this.metrics.addPrimitives(primitive, count);
                            }

                            t += 1;
                        } while(t < endInstances);
                    } else {
                        gl.drawArrays(primitive, firstIndex, count);

                        if (debug) {
                            this.metrics.addPrimitives(primitive, count);
                        }
                    }
                } else {
                    t = ((16 * 3) + 8);
                    if (t < endInstances) {
                        do {
                            setParameters(this, passes, drawParameters[t]);

                            for (p = 0; p < numPasses; p += 1) {
                                pass = passes[p];

                                mask = (pass.semanticsMask & attributeMask);
                                if (mask !== this._clientStateMask) {
                                    this.enableClientState(mask);
                                }

                                this.setPass(pass);

                                gl.drawArrays(primitive, firstIndex, count);
                            }

                            if (debug) {
                                this.metrics.addPrimitives(primitive, count);
                            }

                            t += 1;
                        } while(t < endInstances);
                    } else {
                        for (p = 0; p < numPasses; p += 1) {
                            pass = passes[p];

                            mask = (pass.semanticsMask & attributeMask);
                            if (mask !== this._clientStateMask) {
                                this.enableClientState(mask);
                            }

                            this.setPass(pass);

                            gl.drawArrays(primitive, firstIndex, count);

                            if (debug) {
                                this.metrics.addPrimitives(primitive, count);
                            }
                        }
                    }
                }
            }
            /* tslint:enable:no-bitwise */
        }

        this._activeIndexBuffer = activeIndexBuffer;
    };

    WebGLGraphicsDevice.prototype.beginDraw = function (primitive, numVertices, formats, semantics) {
        debug.assert("number" === typeof primitive);
        debug.assert("number" === typeof numVertices);
        debug.assert(semantics instanceof WebGLSemantics, "semantics must be created with GraphicsDevice.createSemantics");

        this._immediatePrimitive = primitive;
        if (numVertices) {
            var n;
            var immediateSemantics = this._immediateSemantics;
            var numAttributes = semantics.length;
            immediateSemantics.length = numAttributes;
            for (n = 0; n < numAttributes; n += 1) {
                var semantic = semantics[n];
                if (typeof semantic === "string") {
                    semantic = this['SEMANTIC_' + semantic];
                }
                immediateSemantics[n] = semantic;
            }

            var immediateVertexBuffer = this._immediateVertexBuffer;

            var oldStride = immediateVertexBuffer._strideInBytes;
            var oldSize = (oldStride * immediateVertexBuffer.numVertices);

            var stride = immediateVertexBuffer.setAttributes(formats);
            if (stride !== oldStride) {
                immediateVertexBuffer.numVertices = Math.floor(oldSize / stride);
            }

            var size = (stride * numVertices);
            if (size > oldSize) {
                immediateVertexBuffer.resize(size);
            }

            return immediateVertexBuffer.map(0, numVertices);
        }
        return null;
    };

    WebGLGraphicsDevice.prototype.endDraw = function (writer) {
        var immediateVertexBuffer = this._immediateVertexBuffer;

        var numVerticesWritten = writer.getNumWrittenVertices();

        immediateVertexBuffer.unmap(writer);

        if (numVerticesWritten) {
            var gl = this._gl;

            var stride = immediateVertexBuffer._strideInBytes;
            var offset = 0;

            var vertexAttributes = immediateVertexBuffer.attributes;

            var semanticsOffsets = this._semanticsOffsets;

            var semantics = this._immediateSemantics;
            var numSemantics = semantics.length;
            var deltaAttributeMask = 0;
            for (var n = 0; n < numSemantics; n += 1) {
                var vertexAttribute = vertexAttributes[n];

                var semantic = semantics[n];

                /* tslint:disable:no-bitwise */
                deltaAttributeMask |= (1 << semantic);

                /* tslint:enable:no-bitwise */
                // Clear semantics offset cache because this VertexBuffer changes formats
                semanticsOffsets[semantic].vertexBuffer = null;

                gl.vertexAttribPointer(semantic, vertexAttribute.numComponents, vertexAttribute.format, vertexAttribute.normalized, stride, offset);

                offset += vertexAttribute.stride;
            }

            /* tslint:disable:no-bitwise */
            this._attributeMask |= deltaAttributeMask;

            /* tslint:enable:no-bitwise */
            this.draw(this._immediatePrimitive, numVerticesWritten, 0);
        }
    };

    WebGLGraphicsDevice.prototype.setViewport = function (x, y, w, h) {
        var currentBox = this._state.viewportBox;
        if (currentBox[0] !== x || currentBox[1] !== y || currentBox[2] !== w || currentBox[3] !== h) {
            currentBox[0] = x;
            currentBox[1] = y;
            currentBox[2] = w;
            currentBox[3] = h;
            this._gl.viewport(x, y, w, h);
        }
    };

    WebGLGraphicsDevice.prototype.setScissor = function (x, y, w, h) {
        var currentBox = this._state.scissorBox;
        if (currentBox[0] !== x || currentBox[1] !== y || currentBox[2] !== w || currentBox[3] !== h) {
            currentBox[0] = x;
            currentBox[1] = y;
            currentBox[2] = w;
            currentBox[3] = h;
            this._gl.scissor(x, y, w, h);
        }
    };

    WebGLGraphicsDevice.prototype.clear = function (color, depth, stencil) {
        var gl = this._gl;
        var state = this._state;

        var clearMask = 0;

        if (color) {
            clearMask += gl.COLOR_BUFFER_BIT;

            var currentColor = state.clearColor;
            var color0 = color[0];
            var color1 = color[1];
            var color2 = color[2];
            var color3 = color[3];
            if (currentColor[0] !== color0 || currentColor[1] !== color1 || currentColor[2] !== color2 || currentColor[3] !== color3) {
                currentColor[0] = color0;
                currentColor[1] = color1;
                currentColor[2] = color2;
                currentColor[3] = color3;
                gl.clearColor(color0, color1, color2, color3);
            }
        }

        if (typeof depth === 'number') {
            clearMask += gl.DEPTH_BUFFER_BIT;

            if (state.clearDepth !== depth) {
                state.clearDepth = depth;
                gl.clearDepth(depth);
            }

            if (typeof stencil === 'number') {
                clearMask += gl.STENCIL_BUFFER_BIT;

                if (state.clearStencil !== stencil) {
                    state.clearStencil = stencil;
                    gl.clearStencil(stencil);
                }
            }
        }

        if (clearMask) {
            var colorMask = state.colorMask;
            var colorMaskEnabled = (colorMask[0] || colorMask[1] || colorMask[2] || colorMask[3]);
            var depthMask = state.depthMask;
            var program = state.program;

            if (color) {
                if (!colorMaskEnabled) {
                    // This is posibly a mistake, enable it for this call
                    gl.colorMask(true, true, true, true);
                }
            }

            if (typeof depth === 'number') {
                if (!depthMask) {
                    // This is posibly a mistake, enable it for this call
                    gl.depthMask(true);
                }
            }

            if (program) {
                gl.useProgram(null); // Work around for Mac crash bug.
            }

            gl.clear(clearMask);

            if (color) {
                if (!colorMaskEnabled) {
                    gl.colorMask(false, false, false, false);
                }
            }

            if (typeof depth === 'number') {
                if (!depthMask) {
                    gl.depthMask(false);
                }
            }

            if (program) {
                gl.useProgram(program);
            }
        }
    };

    WebGLGraphicsDevice.prototype.beginFrame = function () {
        var gl = this._gl;

        var canvas = gl.canvas;
        var width = (gl.drawingBufferWidth || canvas.width);
        var height = (gl.drawingBufferHeight || canvas.height);
        this.width = width;
        this.height = height;

        this.setScissor(0, 0, this.width, this.height);
        this.setViewport(0, 0, this.width, this.height);

        if (debug) {
            this.metrics.renderTargetChanges = 0;
            this.metrics.textureChanges = 0;
            this.metrics.renderStateChanges = 0;
            this.metrics.vertexAttributesChanges = 0;
            this.metrics.vertexBufferChanges = 0;
            this.metrics.indexBufferChanges = 0;
            this.metrics.vertexArrayObjectChanges = 0;
            this.metrics.techniqueParametersChanges = 0;
            this.metrics.techniqueChanges = 0;
            this.metrics.drawCalls = 0;
            this.metrics.primitives = 0;
        }

        /* tslint:disable:no-string-literal */
        return !(document.hidden || document['webkitHidden']);
        /* tslint:enable:no-string-literal */
    };

    WebGLGraphicsDevice.prototype.beginRenderTarget = function (renderTarget) {
        debug.assert(!this._activeRenderTarget, "beginRenderTarget called before calling endRenderTarget on current render target");
        this._activeRenderTarget = renderTarget;

        if (debug) {
            this.metrics.renderTargetChanges += 1;
        }

        return renderTarget.bind();
    };

    WebGLGraphicsDevice.prototype.endRenderTarget = function () {
        this._activeRenderTarget.unbind();
        this._activeRenderTarget = null;
    };

    WebGLGraphicsDevice.prototype.beginOcclusionQuery = function () {
        return false;
    };

    /* tslint:disable:no-empty */
    WebGLGraphicsDevice.prototype.endOcclusionQuery = function () {
    };

    /* tslint:enable:no-empty */
    WebGLGraphicsDevice.prototype.beginTimerQuery = function () {
        return false;
    };

    /* tslint:disable:no-empty */
    WebGLGraphicsDevice.prototype.endTimerQuery = function () {
    };

    /* tslint:enable:no-empty */
    WebGLGraphicsDevice.prototype.endFrame = function () {
        var gl = this._gl;
        var state = this._state;
        var n;

        //gl.flush();
        if (this._activeTechnique) {
            this._activeTechnique.deactivate();
            this._activeTechnique = null;
        }

        this._attributeMask = 0;

        var clientStateMask = this._clientStateMask;
        if (clientStateMask) {
            for (n = 0; n < 16; n += 1) {
                /* tslint:disable:no-bitwise */
                if (clientStateMask & (1 << n)) {
                    gl.disableVertexAttribArray(n);
                }
                /* tslint:enable:no-bitwise */
            }
            this._clientStateMask = 0;
        }

        if (this._activeIndexBuffer) {
            this._activeIndexBuffer = null;
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }

        if (this._bindedVertexBuffer) {
            this._bindedVertexBuffer = null;
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        }

        var lastMaxTextureUnit = state.lastMaxTextureUnit;
        var textureUnits = state.textureUnits;
        for (n = 0; n < lastMaxTextureUnit; n += 1) {
            var textureUnit = textureUnits[n];
            if (textureUnit.texture) {
                if (state.activeTextureUnit !== n) {
                    state.activeTextureUnit = n;
                    gl.activeTexture(gl.TEXTURE0 + n);
                }
                gl.bindTexture(textureUnit.target, null);
                textureUnit.texture = null;
                textureUnit.target = 0;
            }
        }
        state.lastMaxTextureUnit = 0;

        if (state.program) {
            state.program = null;
            gl.useProgram(null);
        }

        this._numFrames += 1;
        var currentFrameTime = TurbulenzEngine.getTime();
        var diffTime = (currentFrameTime - this._previousFrameTime);
        if (diffTime >= 1000.0) {
            this.fps = (this._numFrames / (diffTime * 0.001));
            this._numFrames = 0;
            this._previousFrameTime = currentFrameTime;
        }

        // Remove any references to external technique parameters
        var techniqueParametersArray = this._techniqueParametersArray;
        for (n = 0; n < techniqueParametersArray.length; n += 1) {
            techniqueParametersArray[n] = null;
        }

        // Reset semantics offsets cache
        var semanticsOffsets = this._semanticsOffsets;
        for (n = 0; n < 16; n += 1) {
            semanticsOffsets[n].vertexBuffer = null;
        }

        this.checkFullScreen();
    };

    WebGLGraphicsDevice.prototype.createTechniqueParameters = function (params) {
        return WebGLTechniqueParameters.create(params);
    };

    WebGLGraphicsDevice.prototype._createTechniqueParametersArray = function (techniqueParameters, techniqueParametersArray) {
        var n = 0;
        var numTechniqueParameters = techniqueParameters.length;
        var t;
        for (t = 0; t < numTechniqueParameters; t += 1) {
            var tp = techniqueParameters[t];
            for (var p in tp) {
                var parameterValues = tp[p];
                if (parameterValues !== undefined) {
                    techniqueParametersArray[n] = p;
                    techniqueParametersArray[n + 1] = parameterValues;
                    n += 2;
                }
            }
        }
        return n;
    };

    WebGLGraphicsDevice.prototype.createSemantics = function (semantics) {
        return WebGLSemantics.create(this, semantics);
    };

    WebGLGraphicsDevice.prototype.createVertexBuffer = function (params) {
        return WebGLVertexBuffer.create(this, params);
    };

    WebGLGraphicsDevice.prototype.createIndexBuffer = function (params) {
        return WebGLIndexBuffer.create(this, params);
    };

    WebGLGraphicsDevice.prototype.createTexture = function (params) {
        return TZWebGLTexture.create(this, params);
    };

    WebGLGraphicsDevice.prototype.createVideo = function (params) {
        return WebGLVideo.create(params);
    };

    WebGLGraphicsDevice.prototype.createShader = function (params, onload) {
        return TZWebGLShader.create(this, params, onload);
    };

    WebGLGraphicsDevice.prototype.createTechniqueParameterBuffer = function (params) {
        // See vmath.ts
        return _tz_techniqueParameterBufferCreate(params);
    };

    WebGLGraphicsDevice.prototype.createRenderBuffer = function (params) {
        return WebGLRenderBuffer.create(this, params);
    };

    WebGLGraphicsDevice.prototype.createRenderTarget = function (params) {
        return WebGLRenderTarget.create(this, params);
    };

    WebGLGraphicsDevice.prototype.createOcclusionQuery = function () {
        return null;
    };

    WebGLGraphicsDevice.prototype.createTimerQuery = function () {
        return null;
    };

    WebGLGraphicsDevice.prototype.createDrawParameters = function () {
        return WebGLDrawParameters.create();
    };

    WebGLGraphicsDevice.prototype.isSupported = function (name) {
        var gl = this._gl;
        if ("OCCLUSION_QUERIES" === name) {
            return false;
        } else if ("TIMER_QUERIES" === name) {
            return false;
        } else if ("NPOT_MIPMAPPED_TEXTURES" === name) {
            return false;
        } else if ("TEXTURE_DXT1" === name || "TEXTURE_DXT3" === name || "TEXTURE_DXT5" === name) {
            var compressedTexturesExtension = this._compressedTexturesExtension;
            if (compressedTexturesExtension) {
                var compressedFormats = gl.getParameter(gl.COMPRESSED_TEXTURE_FORMATS);
                if (compressedFormats) {
                    var requestedFormat;
                    if ("TEXTURE_DXT1" === name) {
                        requestedFormat = compressedTexturesExtension.COMPRESSED_RGBA_S3TC_DXT1_EXT;
                    } else if ("TEXTURE_DXT3" === name) {
                        requestedFormat = compressedTexturesExtension.COMPRESSED_RGBA_S3TC_DXT3_EXT;
                    } else {
                        requestedFormat = compressedTexturesExtension.COMPRESSED_RGBA_S3TC_DXT5_EXT;
                    }
                    var numCompressedFormats = compressedFormats.length;
                    for (var n = 0; n < numCompressedFormats; n += 1) {
                        if (compressedFormats[n] === requestedFormat) {
                            return true;
                        }
                    }
                }
            }
            return false;
        } else if ("TEXTURE_ETC1" === name) {
            return false;
        } else if ("TEXTURE_FLOAT" === name) {
            if (this._floatTextureExtension) {
                return true;
            }
            return false;
        } else if ("TEXTURE_HALF_FLOAT" === name) {
            if (this._halfFloatTextureExtension) {
                return true;
            }
            return false;
        } else if ("INDEXFORMAT_UINT" === name) {
            if (gl.getExtension('OES_element_index_uint')) {
                return true;
            }
            return false;
        } else if ("FILEFORMAT_WEBM" === name) {
            return ("webm" in this._supportedVideoExtensions);
        } else if ("FILEFORMAT_MP4" === name || "FILEFORMAT_M4V" === name) {
            return ("mp4" in this._supportedVideoExtensions);
        } else if ("FILEFORMAT_JPG" === name) {
            return true;
        } else if ("FILEFORMAT_PNG" === name) {
            return true;
        } else if ("FILEFORMAT_DDS" === name) {
            return typeof DDSLoader !== 'undefined';
        } else if ("FILEFORMAT_TGA" === name) {
            return typeof TGALoader !== 'undefined';
        } else if ("DEPTH_TEXTURE" === name) {
            return this._depthTextureExtension;
        } else if ("STANDARD_DERIVATIVES" === name) {
            return this._standardDerivativesExtension;
        }
        return undefined;
    };

    WebGLGraphicsDevice.prototype.maxSupported = function (name) {
        var gl = this._gl;
        if ("ANISOTROPY" === name) {
            return this._maxAnisotropy;
        } else if ("TEXTURE_SIZE" === name) {
            return gl.getParameter(gl.MAX_TEXTURE_SIZE);
        } else if ("CUBEMAP_TEXTURE_SIZE" === name) {
            return gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
        } else if ("3D_TEXTURE_SIZE" === name) {
            return 0;
        } else if ("RENDERTARGET_COLOR_TEXTURES" === name) {
            if (this._drawBuffersExtension) {
                if (this._WEBGL_draw_buffers) {
                    return gl.getParameter(this._drawBuffersExtension.MAX_COLOR_ATTACHMENTS_WEBGL);
                } else {
                    return gl.getParameter(this._drawBuffersExtension.MAX_COLOR_ATTACHMENTS_EXT);
                }
            }
            return 1;
        } else if ("RENDERBUFFER_SIZE" === name) {
            return gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
        } else if ("TEXTURE_UNITS" === name) {
            return gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        } else if ("VERTEX_TEXTURE_UNITS" === name) {
            return gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
        } else if ("VERTEX_SHADER_PRECISION" === name || "FRAGMENT_SHADER_PRECISION" === name) {
            var shaderType;
            if ("VERTEX_SHADER_PRECISION" === name) {
                shaderType = gl.VERTEX_SHADER;
            } else {
                shaderType = gl.FRAGMENT_SHADER;
            }

            if (!gl.getShaderPrecisionFormat) {
                return 0;
            }

            var sp = gl.getShaderPrecisionFormat(shaderType, gl.HIGH_FLOAT);
            if (!sp || !sp.precision) {
                sp = gl.getShaderPrecisionFormat(shaderType, gl.MEDIUM_FLOAT);
                if (!sp || !sp.precision) {
                    sp = gl.getShaderPrecisionFormat(shaderType, gl.LOW_FLOAT);
                    if (!sp || !sp.precision) {
                        return 0;
                    }
                }
            }
            return sp.precision;
        }
        return 0;
    };

    WebGLGraphicsDevice.prototype.loadTexturesArchive = function (params) {
        var src = params.src;
        if (typeof TARLoader !== 'undefined') {
            TARLoader.create({
                gd: this,
                src: src,
                mipmaps: params.mipmaps,
                ontextureload: function tarTextureLoadedFn(texture) {
                    params.ontextureload(texture);
                },
                onload: function tarLoadedFn(success, status) {
                    if (params.onload) {
                        params.onload(success, status);
                    }
                },
                onerror: function tarFailedFn(status) {
                    if (params.onload) {
                        params.onload(false, status);
                    }
                }
            });
            return true;
        } else {
            TurbulenzEngine.callOnError('Missing archive loader required for ' + src);
            return false;
        }
    };

    WebGLGraphicsDevice.prototype.getScreenshot = function (compress, x, y, width, height) {
        var gl = this._gl;
        var canvas = gl.canvas;

        if (compress) {
            return canvas.toDataURL('image/jpeg');
        } else {
            if (x === undefined) {
                x = 0;
            }

            if (y === undefined) {
                y = 0;
            }

            var target = this._activeRenderTarget;
            if (!target) {
                target = canvas;
            }

            if (width === undefined) {
                width = target.width;
            }

            if (height === undefined) {
                height = target.height;
            }

            var pixels = new Uint8Array(4 * width * height);

            gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

            return pixels;
        }
    };

    WebGLGraphicsDevice.prototype.flush = function () {
        this._gl.flush();
    };

    WebGLGraphicsDevice.prototype.finish = function () {
        this._gl.finish();
    };

    // private
    WebGLGraphicsDevice.prototype._drawArraySortPositive = function (a, b) {
        return (b.sortKey - a.sortKey);
    };

    WebGLGraphicsDevice.prototype._drawArraySortNegative = function (a, b) {
        return (a.sortKey - b.sortKey);
    };

    WebGLGraphicsDevice.prototype.checkFullScreen = function () {
        var fullscreen = this.fullscreen;
        if (this._oldFullscreen !== fullscreen) {
            this._oldFullscreen = fullscreen;

            this.requestFullScreen(fullscreen);
        }
    };

    WebGLGraphicsDevice.prototype.requestFullScreen = function (fullscreen) {
        if (fullscreen) {
            var canvas = this._gl.canvas;
            if (canvas.webkitRequestFullScreenWithKeys) {
                canvas.webkitRequestFullScreenWithKeys();
            } else if (canvas.requestFullScreenWithKeys) {
                canvas.requestFullScreenWithKeys();
            } else if (canvas.webkitRequestFullScreen) {
                canvas.webkitRequestFullScreen(canvas.ALLOW_KEYBOARD_INPUT);
            } else if (canvas.mozRequestFullScreen) {
                canvas.mozRequestFullScreen();
            } else if (canvas.msRequestFullscreen) {
                canvas.msRequestFullscreen();
            } else if (canvas.requestFullScreen) {
                canvas.requestFullScreen();
            } else if (canvas.requestFullscreen) {
                canvas.requestFullscreen();
            }
        } else {
            /* tslint:disable:no-string-literal */
            if (document.webkitCancelFullScreen) {
                document.webkitCancelFullScreen();
            } else if (document['mozCancelFullScreen']) {
                document['mozCancelFullScreen']();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else if (document.cancelFullScreen) {
                document.cancelFullScreen();
            } else if (document.exitFullscreen) {
                document.exitFullscreen();
            }
            /* tslint:enable:no-string-literal */
        }
        return true;
    };

    WebGLGraphicsDevice.prototype._createSampler = function (sampler) {
        var samplerKey = sampler.minFilter.toString() + ':' + sampler.magFilter.toString() + ':' + sampler.wrapS.toString() + ':' + sampler.wrapT.toString() + ':' + sampler.wrapR.toString() + ':' + sampler.maxAnisotropy.toString();

        var cachedSamplers = this._cachedSamplers;
        var cachedSampler = cachedSamplers[samplerKey];
        if (!cachedSampler) {
            cachedSamplers[samplerKey] = sampler;
            return sampler;
        }
        return cachedSampler;
    };

    WebGLGraphicsDevice.prototype._deleteIndexBuffer = function (indexBuffer) {
        var gl = this._gl;
        if (gl) {
            if (this._activeIndexBuffer === indexBuffer) {
                this._activeIndexBuffer = null;
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            }
            gl.deleteBuffer(indexBuffer._glBuffer);
        }

        if (this._cachedVAOs) {
            delete this._cachedVAOs[indexBuffer.id];
        }
    };

    WebGLGraphicsDevice.prototype.bindVertexBuffer = function (buffer) {
        if (this._bindedVertexBuffer !== buffer) {
            this._bindedVertexBuffer = buffer;

            var gl = this._gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

            if (debug) {
                this.metrics.vertexBufferChanges += 1;
            }
        }
    };

    WebGLGraphicsDevice.prototype._deleteVertexBuffer = function (vertexBuffer) {
        var gl = this._gl;
        if (gl) {
            if (this._bindedVertexBuffer === vertexBuffer._glBuffer) {
                this._bindedVertexBuffer = null;
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
            }
            gl.deleteBuffer(vertexBuffer._glBuffer);
        }
    };

    WebGLGraphicsDevice.prototype._temporaryBindTexture = function (target, texture) {
        var state = this._state;
        var gl = this._gl;

        var dummyUnit = Math.min(state.lastMaxTextureUnit, (state.maxTextureUnit - 1));
        if (state.activeTextureUnit !== dummyUnit) {
            state.activeTextureUnit = dummyUnit;
            gl.activeTexture(gl.TEXTURE0 + dummyUnit);
        }
        gl.bindTexture(target, texture);

        if (debug) {
            this.metrics.textureChanges += 1;
        }
    };

    WebGLGraphicsDevice.prototype.unbindTexture = function (texture) {
        var gl = this._gl;
        var state = this._state;
        var lastMaxTextureUnit = state.lastMaxTextureUnit;
        var textureUnits = state.textureUnits;
        for (var u = 0; u < lastMaxTextureUnit; u += 1) {
            var textureUnit = textureUnits[u];
            if (textureUnit.texture === texture) {
                if (state.activeTextureUnit !== u) {
                    state.activeTextureUnit = u;
                    gl.activeTexture(gl.TEXTURE0 + u);
                }
                gl.bindTexture(textureUnit.target, null);
                textureUnit.texture = null;
            }
        }
    };

    WebGLGraphicsDevice.prototype.setSampler = function (sampler, target) {
        if (sampler) {
            var gl = this._gl;

            gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, sampler.minFilter);
            gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, sampler.magFilter);
            gl.texParameteri(target, gl.TEXTURE_WRAP_S, sampler.wrapS);
            gl.texParameteri(target, gl.TEXTURE_WRAP_T, sampler.wrapT);

            /*
            if (sSupports3DTextures)
            {
            gl.texParameteri(target, gl.TEXTURE_WRAP_R, sampler.wrapR);
            }
            */
            if (this._TEXTURE_MAX_ANISOTROPY_EXT) {
                gl.texParameteri(target, this._TEXTURE_MAX_ANISOTROPY_EXT, sampler.maxAnisotropy);
            }
        }
    };

    WebGLGraphicsDevice.prototype.setPass = function (pass) {
        var gl = this._gl;
        var state = this._state;

        // Set renderstates
        var renderStatesSet = pass.statesSet;
        var renderStates = pass.states;
        var numRenderStates = renderStates.length;
        var r, renderState;
        for (r = 0; r < numRenderStates; r += 1) {
            renderState = renderStates[r];
            renderState.set.apply(renderState, renderState.values);
        }

        // Reset previous renderstates
        var renderStatesToReset = state.renderStatesToReset;
        var numRenderStatesToReset = renderStatesToReset.length;
        for (r = 0; r < numRenderStatesToReset; r += 1) {
            renderState = renderStatesToReset[r];
            if (!(renderState.name in renderStatesSet)) {
                renderState.reset();
            }
        }

        // Copy set renderstates to be reset later
        state.renderStatesToReset = renderStates;

        state.lastMaxTextureUnit = Math.max(pass.numTextureUnits, state.lastMaxTextureUnit);

        var program = pass.glProgram;
        if (state.program !== program) {
            state.program = program;
            gl.useProgram(program);
        }

        if (pass.dirty) {
            pass.updateParametersData(this);
        }
    };

    WebGLGraphicsDevice.prototype.enableClientState = function (mask) {
        var gl = this._gl;

        var oldMask = this._clientStateMask;
        this._clientStateMask = mask;

        /* tslint:disable:no-bitwise */
        var disableMask = (oldMask & (~mask));
        var enableMask = ((~oldMask) & mask);
        var n;

        if (disableMask) {
            if ((disableMask & 0xff) === 0) {
                disableMask >>= 8;
                n = 8;
            } else {
                n = 0;
            }
            do {
                if (0 !== (0x01 & disableMask)) {
                    gl.disableVertexAttribArray(n);
                }
                n += 1;
                disableMask >>= 1;
            } while(disableMask);
        }

        if (enableMask) {
            if ((enableMask & 0xff) === 0) {
                enableMask >>= 8;
                n = 8;
            } else {
                n = 0;
            }
            do {
                if (0 !== (0x01 & enableMask)) {
                    gl.enableVertexAttribArray(n);
                }
                n += 1;
                enableMask >>= 1;
            } while(enableMask);
        }
        /* tslint:enable:no-bitwise */
    };

    WebGLGraphicsDevice.prototype._setTexture = function (textureUnitIndex, texture, sampler) {
        var state = this._state;
        var gl = this._gl;

        var textureUnit = state.textureUnits[textureUnitIndex];
        var oldgltarget = textureUnit.target;
        var oldglobject = textureUnit.texture;

        if (texture) {
            var gltarget = texture._target;
            var globject = texture._glTexture;
            if (oldglobject !== globject || oldgltarget !== gltarget) {
                textureUnit.target = gltarget;
                textureUnit.texture = globject;

                if (state.activeTextureUnit !== textureUnitIndex) {
                    state.activeTextureUnit = textureUnitIndex;
                    gl.activeTexture(gl.TEXTURE0 + textureUnitIndex);
                }

                if (oldgltarget !== gltarget && oldglobject) {
                    gl.bindTexture(oldgltarget, null);
                }

                gl.bindTexture(gltarget, globject);

                if (texture._sampler !== sampler) {
                    texture._sampler = sampler;

                    this.setSampler(sampler, gltarget);
                }

                if (debug) {
                    this.metrics.textureChanges += 1;
                }
            }
        } else {
            if (oldgltarget && oldglobject) {
                textureUnit.target = 0;
                textureUnit.texture = null;

                if (state.activeTextureUnit !== textureUnitIndex) {
                    state.activeTextureUnit = textureUnitIndex;
                    gl.activeTexture(gl.TEXTURE0 + textureUnitIndex);
                }

                gl.bindTexture(oldgltarget, null);

                if (debug) {
                    this.metrics.textureChanges += 1;
                }
            }
        }
    };

    WebGLGraphicsDevice.prototype.setProgram = function (program) {
        var state = this._state;
        if (state.program !== program) {
            state.program = program;
            this._gl.useProgram(program);
        }
    };

    WebGLGraphicsDevice.prototype.syncState = function () {
        var state = this._state;
        var gl = this._gl;

        if (state.depthTestEnable) {
            gl.enable(gl.DEPTH_TEST);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }

        gl.depthFunc(state.depthFunc);

        gl.depthMask(state.depthMask);

        if (state.blendEnable) {
            gl.enable(gl.BLEND);
        } else {
            gl.disable(gl.BLEND);
        }

        gl.blendFunc(state.blendSrc, state.blendDst);

        if (state.cullFaceEnable) {
            gl.enable(gl.CULL_FACE);
        } else {
            gl.disable(gl.CULL_FACE);
        }

        gl.cullFace(state.cullFace);

        gl.frontFace(state.frontFace);

        var colorMask = state.colorMask;
        gl.colorMask(colorMask[0], colorMask[1], colorMask[2], colorMask[3]);

        if (state.stencilTestEnable) {
            gl.enable(gl.STENCIL_TEST);
        } else {
            gl.disable(gl.STENCIL_TEST);
        }

        gl.stencilFunc(state.stencilFunc, state.stencilRef, state.stencilMask);

        gl.stencilOp(state.stencilFail, state.stencilZFail, state.stencilZPass);

        if (state.polygonOffsetFillEnable) {
            gl.enable(gl.POLYGON_OFFSET_FILL);
        } else {
            gl.disable(gl.POLYGON_OFFSET_FILL);
        }

        gl.polygonOffset(state.polygonOffsetFactor, state.polygonOffsetUnits);

        gl.lineWidth(state.lineWidth);

        gl.activeTexture(gl.TEXTURE0 + state.activeTextureUnit);

        var currentBox = this._state.viewportBox;
        gl.viewport(currentBox[0], currentBox[1], currentBox[2], currentBox[3]);

        currentBox = this._state.scissorBox;
        gl.scissor(currentBox[0], currentBox[1], currentBox[2], currentBox[3]);

        var currentColor = state.clearColor;
        gl.clearColor(currentColor[0], currentColor[1], currentColor[2], currentColor[3]);

        gl.clearDepth(state.clearDepth);

        gl.clearStencil(state.clearStencil);
    };

    WebGLGraphicsDevice.prototype.destroy = function () {
        delete this._activeTechnique;
        delete this._activeIndexBuffer;
        delete this._bindedVertexBuffer;

        if (this._immediateVertexBuffer) {
            this._immediateVertexBuffer.destroy();
            delete this._immediateVertexBuffer;
        }

        delete this._gl;

        if (typeof DDSLoader !== 'undefined') {
            DDSLoader.destroy();
        }
    };

    WebGLGraphicsDevice.create = function (canvas, params) {
        var getAvailableContext = function getAvailableContextFn(canvas, params, contextList) {
            if (canvas.getContext) {
                var canvasParams = {
                    alpha: false,
                    depth: true,
                    stencil: true,
                    antialias: false
                };

                var multisample = params.multisample;
                if (multisample !== undefined && 1 < multisample) {
                    canvasParams.antialias = true;
                }

                var alpha = params.alpha;
                if (alpha) {
                    canvasParams.alpha = true;
                }

                if (params.depth === false) {
                    canvasParams.depth = false;
                }

                if (params.stencil === false) {
                    canvasParams.stencil = false;
                }

                var numContexts = contextList.length, i;
                for (i = 0; i < numContexts; i += 1) {
                    try  {
                        var context = canvas.getContext(contextList[i], canvasParams);
                        if (context) {
                            return context;
                        }
                    } catch (ex) {
                    }
                    /* tslint:enable:no-empty */
                }
            }
            return null;
        };

        // TODO: Test if we can also use "webkit-3d" and "moz-webgl"
        var gl = getAvailableContext(canvas, params, ['webgl', 'experimental-webgl']);
        if (!gl) {
            return null;
        }

        var width = (gl.drawingBufferWidth || canvas.width);
        var height = (gl.drawingBufferHeight || canvas.height);

        gl.enable(gl.SCISSOR_TEST);
        gl.depthRange(0.0, 1.0);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

        //gl.hint(gl.GENERATE_MIPMAP_HINT, gl.NICEST);
        var gd = new WebGLGraphicsDevice();
        gd._gl = gl;
        gd.width = width;
        gd.height = height;

        var extensions = gl.getSupportedExtensions();

        var extensionsMap = {};
        var numExtensions = extensions.length;
        var n;
        for (n = 0; n < numExtensions; n += 1) {
            extensionsMap[extensions[n]] = true;
        }

        if (extensions) {
            extensions = extensions.join(' ');
        } else {
            extensions = '';
        }
        gd.extensions = extensions;
        gd.shadingLanguageVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
        gd.rendererVersion = gl.getParameter(gl.VERSION);
        gd.renderer = gl.getParameter(gl.RENDERER);
        gd.vendor = gl.getParameter(gl.VENDOR);

        /* tslint:disable:no-string-literal */
        if (extensionsMap['WEBGL_compressed_texture_s3tc']) {
            gd._WEBGL_compressed_texture_s3tc = true;
            gd._compressedTexturesExtension = gl.getExtension('WEBGL_compressed_texture_s3tc');
        } else if (extensionsMap['WEBKIT_WEBGL_compressed_texture_s3tc']) {
            gd._WEBGL_compressed_texture_s3tc = true;
            gd._compressedTexturesExtension = gl.getExtension('WEBKIT_WEBGL_compressed_texture_s3tc');
        } else if (extensionsMap['MOZ_WEBGL_compressed_texture_s3tc']) {
            gd._WEBGL_compressed_texture_s3tc = true;
            gd._compressedTexturesExtension = gl.getExtension('MOZ_WEBGL_compressed_texture_s3tc');
        } else if (extensionsMap['WEBKIT_WEBGL_compressed_textures']) {
            gd._compressedTexturesExtension = gl.getExtension('WEBKIT_WEBGL_compressed_textures');
        }

        if (extensionsMap['WEBGL_depth_texture']) {
            gd._depthTextureExtension = true;
            gl.getExtension('WEBGL_depth_texture');
        } else if (extensionsMap['WEBKIT_WEBGL_depth_texture']) {
            gd._depthTextureExtension = true;
            gl.getExtension('WEBKIT_WEBGL_depth_texture');
        } else if (extensionsMap['MOZ_WEBGL_depth_texture']) {
            gd._depthTextureExtension = true;
            gl.getExtension('MOZ_WEBGL_depth_texture');
        }

        if (extensionsMap['OES_standard_derivatives']) {
            gd._standardDerivativesExtension = true;
            gl.getExtension('OES_standard_derivatives');
        }

        var anisotropyExtension;
        if (extensionsMap['EXT_texture_filter_anisotropic']) {
            anisotropyExtension = gl.getExtension('EXT_texture_filter_anisotropic');
        } else if (extensionsMap['MOZ_EXT_texture_filter_anisotropic']) {
            anisotropyExtension = gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
        } else if (extensionsMap['WEBKIT_EXT_texture_filter_anisotropic']) {
            anisotropyExtension = gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
        }
        if (anisotropyExtension) {
            gd._TEXTURE_MAX_ANISOTROPY_EXT = anisotropyExtension.TEXTURE_MAX_ANISOTROPY_EXT;
            gd._maxAnisotropy = gl.getParameter(anisotropyExtension.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        } else {
            gd._maxAnisotropy = 1;
        }

        // Enable OES_element_index_uint extension
        gl.getExtension('OES_element_index_uint');

        if (extensionsMap['WEBGL_draw_buffers']) {
            gd._WEBGL_draw_buffers = true;
            gd._drawBuffersExtension = gl.getExtension('WEBGL_draw_buffers');
        } else if (extensionsMap['EXT_draw_buffers']) {
            gd._drawBuffersExtension = gl.getExtension('EXT_draw_buffers');
        }

        /* tslint:enable:no-string-literal */
        // Enagle OES_texture_float extension
        if (extensionsMap['OES_texture_float']) {
            gd._floatTextureExtension = gl.getExtension('OES_texture_float');
        }
        if (extensionsMap['WEBGL_color_buffer_float']) {
            gd._floatTextureExtension = gl.getExtension('WEBGL_color_buffer_float');
        }

        // Enagle OES_texture_float_linear extension
        if (extensionsMap['OES_texture_float_linear']) {
            gl.getExtension('OES_texture_float_linear');
        }

        // Enagle OES_texture_float extension
        if (extensionsMap['OES_texture_half_float']) {
            gd._halfFloatTextureExtension = gl.getExtension('OES_texture_half_float');
        }
        if (extensionsMap['WEBGL_color_buffer_half_float']) {
            gl.getExtension('WEBGL_color_buffer_half_float');
        }

        // Enagle OES_texture_half_float_linear  extension
        if (extensionsMap['OES_texture_half_float_linear']) {
            gl.getExtension('OES_texture_half_float_linear');
        }

        // Enagle OES_vertex_array_object extension
        if (extensionsMap['OES_vertex_array_object']) {
            gd.drawArray = gd.drawArrayVAO;
            gd._vertexArrayObjectExtension = gl.getExtension('OES_vertex_array_object');
            gd._cachedVAOs = {};
        }

        if (extensionsMap['WEBGL_debug_renderer_info']) {
            var debugRendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
            gd.vendor = gl.getParameter(debugRendererInfo.UNMASKED_VENDOR_WEBGL);
            gd.renderer = gl.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL);
        }

        var proto = WebGLGraphicsDevice.prototype;

        proto.PRIMITIVE_POINTS = gl.POINTS;
        proto.PRIMITIVE_LINES = gl.LINES;
        proto.PRIMITIVE_LINE_LOOP = gl.LINE_LOOP;
        proto.PRIMITIVE_LINE_STRIP = gl.LINE_STRIP;
        proto.PRIMITIVE_TRIANGLES = gl.TRIANGLES;
        proto.PRIMITIVE_TRIANGLE_STRIP = gl.TRIANGLE_STRIP;
        proto.PRIMITIVE_TRIANGLE_FAN = gl.TRIANGLE_FAN;

        proto.INDEXFORMAT_UBYTE = gl.UNSIGNED_BYTE;
        proto.INDEXFORMAT_USHORT = gl.UNSIGNED_SHORT;
        proto.INDEXFORMAT_UINT = gl.UNSIGNED_INT;

        // Detect IE11 partial WebGL implementation...
        var ieVersionIndex = (gd.vendor === 'Microsoft' ? gd.rendererVersion.indexOf('0.9') : -1);
        if (-1 !== ieVersionIndex) {
            gd._fixIE = gd.rendererVersion.substr(ieVersionIndex, 4);
        } else {
            gd._fixIE = null;
        }

        var getNormalizationScale = function getNormalizationScaleFn(format) {
            if (format === gl.BYTE) {
                return 0x7f;
            } else if (format === gl.UNSIGNED_BYTE) {
                return 0xff;
            } else if (format === gl.SHORT) {
                return 0x7fff;
            } else if (format === gl.UNSIGNED_SHORT) {
                return 0xffff;
            } else if (format === gl.INT) {
                return 0x7fffffff;
            } else if (format === gl.UNSIGNED_INT) {
                return 0xffffffff;
            } else {
                return 1;
            }
        };

        var makeVertexformat = function makeVertexformatFn(n, c, s, f, name) {
            var attributeFormat = {
                numComponents: c,
                stride: s,
                componentStride: (s / c),
                format: f,
                name: name,
                normalized: undefined,
                normalizationScale: undefined,
                typedSetter: undefined,
                typedArray: undefined
            };
            if (n) {
                attributeFormat.normalized = true;
                attributeFormat.normalizationScale = getNormalizationScale(f);
            } else {
                attributeFormat.normalized = false;
                attributeFormat.normalizationScale = 1;
            }

            if (typeof DataView !== 'undefined' && 'setFloat32' in DataView.prototype) {
                if (f === gl.BYTE) {
                    attributeFormat.typedSetter = DataView.prototype.setInt8;
                } else if (f === gl.UNSIGNED_BYTE) {
                    attributeFormat.typedSetter = DataView.prototype.setUint8;
                } else if (f === gl.SHORT) {
                    attributeFormat.typedSetter = DataView.prototype.setInt16;
                } else if (f === gl.UNSIGNED_SHORT) {
                    attributeFormat.typedSetter = DataView.prototype.setUint16;
                } else if (f === gl.INT) {
                    attributeFormat.typedSetter = DataView.prototype.setInt32;
                } else if (f === gl.UNSIGNED_INT) {
                    attributeFormat.typedSetter = DataView.prototype.setUint32;
                } else {
                    attributeFormat.typedSetter = DataView.prototype.setFloat32;
                }
            } else {
                if (f === gl.BYTE) {
                    attributeFormat.typedArray = Int8Array;
                } else if (f === gl.UNSIGNED_BYTE) {
                    attributeFormat.typedArray = Uint8Array;
                } else if (f === gl.SHORT) {
                    attributeFormat.typedArray = Int16Array;
                } else if (f === gl.UNSIGNED_SHORT) {
                    attributeFormat.typedArray = Uint16Array;
                } else if (f === gl.INT) {
                    attributeFormat.typedArray = Int32Array;
                } else if (f === gl.UNSIGNED_INT) {
                    attributeFormat.typedArray = Uint32Array;
                } else {
                    attributeFormat.typedArray = Float32Array;
                }
            }
            return attributeFormat;
        };

        if (gd._fixIE && gd._fixIE < "0.94") {
            proto.VERTEXFORMAT_BYTE4 = makeVertexformat(0, 4, 16, gl.FLOAT, 'BYTE4');
            proto.VERTEXFORMAT_UBYTE4 = makeVertexformat(0, 4, 16, gl.FLOAT, 'UBYTE4');
            proto.VERTEXFORMAT_SHORT2 = makeVertexformat(0, 2, 8, gl.FLOAT, 'SHORT2');
            proto.VERTEXFORMAT_SHORT4 = makeVertexformat(0, 4, 16, gl.FLOAT, 'SHORT4');
            proto.VERTEXFORMAT_USHORT2 = makeVertexformat(0, 2, 8, gl.FLOAT, 'USHORT2');
            proto.VERTEXFORMAT_USHORT4 = makeVertexformat(0, 4, 16, gl.FLOAT, 'USHORT4');
        } else {
            proto.VERTEXFORMAT_BYTE4 = makeVertexformat(0, 4, 4, gl.BYTE, 'BYTE4');
            proto.VERTEXFORMAT_UBYTE4 = makeVertexformat(0, 4, 4, gl.UNSIGNED_BYTE, 'UBYTE4');
            proto.VERTEXFORMAT_SHORT2 = makeVertexformat(0, 2, 4, gl.SHORT, 'SHORT2');
            proto.VERTEXFORMAT_SHORT4 = makeVertexformat(0, 4, 8, gl.SHORT, 'SHORT4');
            proto.VERTEXFORMAT_USHORT2 = makeVertexformat(0, 2, 4, gl.UNSIGNED_SHORT, 'USHORT2');
            proto.VERTEXFORMAT_USHORT4 = makeVertexformat(0, 4, 8, gl.UNSIGNED_SHORT, 'USHORT4');
        }
        if (gd._fixIE && gd._fixIE < "0.93") {
            proto.VERTEXFORMAT_BYTE4N = makeVertexformat(0, 4, 16, gl.FLOAT, 'BYTE4N');
            proto.VERTEXFORMAT_UBYTE4N = makeVertexformat(0, 4, 16, gl.FLOAT, 'UBYTE4N');
            proto.VERTEXFORMAT_SHORT2N = makeVertexformat(0, 2, 8, gl.FLOAT, 'SHORT2N');
            proto.VERTEXFORMAT_SHORT4N = makeVertexformat(0, 4, 16, gl.FLOAT, 'SHORT4N');
            proto.VERTEXFORMAT_USHORT2N = makeVertexformat(0, 2, 8, gl.FLOAT, 'USHORT2N');
            proto.VERTEXFORMAT_USHORT4N = makeVertexformat(0, 4, 16, gl.FLOAT, 'USHORT4N');
        } else {
            proto.VERTEXFORMAT_BYTE4N = makeVertexformat(1, 4, 4, gl.BYTE, 'BYTE4N');
            proto.VERTEXFORMAT_UBYTE4N = makeVertexformat(1, 4, 4, gl.UNSIGNED_BYTE, 'UBYTE4N');
            proto.VERTEXFORMAT_SHORT2N = makeVertexformat(1, 2, 4, gl.SHORT, 'SHORT2N');
            proto.VERTEXFORMAT_SHORT4N = makeVertexformat(1, 4, 8, gl.SHORT, 'SHORT4N');
            proto.VERTEXFORMAT_USHORT2N = makeVertexformat(1, 2, 4, gl.UNSIGNED_SHORT, 'USHORT2N');
            proto.VERTEXFORMAT_USHORT4N = makeVertexformat(1, 4, 8, gl.UNSIGNED_SHORT, 'USHORT4N');
        }
        proto.VERTEXFORMAT_FLOAT1 = makeVertexformat(0, 1, 4, gl.FLOAT, 'FLOAT1');
        proto.VERTEXFORMAT_FLOAT2 = makeVertexformat(0, 2, 8, gl.FLOAT, 'FLOAT2');
        proto.VERTEXFORMAT_FLOAT3 = makeVertexformat(0, 3, 12, gl.FLOAT, 'FLOAT3');
        proto.VERTEXFORMAT_FLOAT4 = makeVertexformat(0, 4, 16, gl.FLOAT, 'FLOAT4');

        var maxAttributes = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
        if (maxAttributes < 16) {
            proto.SEMANTIC_ATTR0 = proto.SEMANTIC_POSITION = proto.SEMANTIC_POSITION0 = 0;

            proto.SEMANTIC_ATTR1 = proto.SEMANTIC_BLENDWEIGHT = proto.SEMANTIC_BLENDWEIGHT0 = 1;

            proto.SEMANTIC_ATTR2 = proto.SEMANTIC_NORMAL = proto.SEMANTIC_NORMAL0 = 2;

            proto.SEMANTIC_ATTR3 = proto.SEMANTIC_COLOR = proto.SEMANTIC_COLOR0 = 3;

            proto.SEMANTIC_ATTR7 = proto.SEMANTIC_BLENDINDICES = proto.SEMANTIC_BLENDINDICES0 = 4;

            proto.SEMANTIC_ATTR8 = proto.SEMANTIC_TEXCOORD = proto.SEMANTIC_TEXCOORD0 = 5;

            proto.SEMANTIC_ATTR9 = proto.SEMANTIC_TEXCOORD1 = 6;

            proto.SEMANTIC_ATTR14 = proto.SEMANTIC_TEXCOORD6 = proto.SEMANTIC_TANGENT = proto.SEMANTIC_TANGENT0 = 7;

            proto.SEMANTIC_ATTR15 = proto.SEMANTIC_TEXCOORD7 = proto.SEMANTIC_BINORMAL0 = proto.SEMANTIC_BINORMAL = 8;

            proto.SEMANTIC_ATTR10 = proto.SEMANTIC_TEXCOORD2 = 9;

            proto.SEMANTIC_ATTR11 = proto.SEMANTIC_TEXCOORD3 = 10;

            proto.SEMANTIC_ATTR12 = proto.SEMANTIC_TEXCOORD4 = 11;

            proto.SEMANTIC_ATTR13 = proto.SEMANTIC_TEXCOORD5 = 12;

            proto.SEMANTIC_ATTR4 = proto.SEMANTIC_COLOR1 = proto.SEMANTIC_SPECULAR = 13;

            proto.SEMANTIC_ATTR5 = proto.SEMANTIC_FOGCOORD = proto.SEMANTIC_TESSFACTOR = 14;

            proto.SEMANTIC_ATTR6 = proto.SEMANTIC_PSIZE = proto.SEMANTIC_PSIZE0 = 15;
        }

        proto.DEFAULT_SAMPLER = {
            minFilter: gl.LINEAR_MIPMAP_LINEAR,
            magFilter: gl.LINEAR,
            wrapS: gl.REPEAT,
            wrapT: gl.REPEAT,
            wrapR: gl.REPEAT,
            maxAnisotropy: 1
        };

        gd._cachedSamplers = {};

        var maxTextureUnit = 1;
        var maxUnit = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        if (maxTextureUnit < maxUnit) {
            maxTextureUnit = maxUnit;
        }
        maxUnit = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
        if (maxTextureUnit < maxUnit) {
            maxTextureUnit = maxUnit;
        }

        var textureUnits = [];
        textureUnits.length = maxTextureUnit;
        for (var t = 0; t < maxTextureUnit; t += 1) {
            textureUnits[t] = {
                texture: null,
                target: 0
            };
        }

        var defaultDepthFunc = gl.LEQUAL;
        var defaultBlendFuncSrc = gl.SRC_ALPHA;
        var defaultBlendFuncDst = gl.ONE_MINUS_SRC_ALPHA;
        var defaultCullFace = gl.BACK;
        var defaultFrontFace = gl.CCW;
        var defaultStencilFunc = gl.ALWAYS;
        var defaultStencilOp = gl.KEEP;

        var currentState = {
            depthTestEnable: true,
            blendEnable: false,
            cullFaceEnable: true,
            stencilTestEnable: false,
            polygonOffsetFillEnable: false,
            depthMask: true,
            depthFunc: defaultDepthFunc,
            blendSrc: defaultBlendFuncSrc,
            blendDst: defaultBlendFuncDst,
            cullFace: defaultCullFace,
            frontFace: defaultFrontFace,
            colorMask: [true, true, true, true],
            stencilFunc: defaultStencilFunc,
            stencilRef: 0,
            stencilMask: 0xffffffff,
            stencilFail: defaultStencilOp,
            stencilZFail: defaultStencilOp,
            stencilZPass: defaultStencilOp,
            polygonOffsetFactor: 0,
            polygonOffsetUnits: 0,
            lineWidth: 1,
            renderStatesToReset: [],
            viewportBox: [0, 0, width, height],
            scissorBox: [0, 0, width, height],
            clearColor: [0, 0, 0, 1],
            clearDepth: 1.0,
            clearStencil: 0,
            activeTextureUnit: 0,
            maxTextureUnit: maxTextureUnit,
            lastMaxTextureUnit: 0,
            textureUnits: textureUnits,
            program: null
        };
        gd._state = currentState;

        gd._counters = {
            textures: 0,
            vertexBuffers: 0,
            indexBuffers: 0,
            renderTargets: 0,
            renderBuffers: 0,
            shaders: 0,
            techniques: 0
        };

        /* tslint:disable:no-bitwise */
        if (debug) {
            gd.metrics = {
                renderTargetChanges: 0,
                textureChanges: 0,
                renderStateChanges: 0,
                vertexAttributesChanges: 0,
                vertexBufferChanges: 0,
                indexBufferChanges: 0,
                vertexArrayObjectChanges: 0,
                techniqueParametersChanges: 0,
                techniqueChanges: 0,
                drawCalls: 0,
                primitives: 0,
                addPrimitives: function addPrimitivesFn(primitive, count) {
                    this.drawCalls += 1;
                    switch (primitive) {
                        case 0x0000:
                            this.primitives += count;
                            break;
                        case 0x0001:
                            this.primitives += (count >> 1);
                            break;
                        case 0x0002:
                            this.primitives += count;
                            break;
                        case 0x0003:
                            this.primitives += count - 1;
                            break;
                        case 0x0004:
                            this.primitives += (count / 3) | 0;
                            break;
                        case 0x0005:
                            this.primitives += count - 2;
                            break;
                        case 0x0006:
                            this.primitives += count - 2;
                            break;
                    }
                }
            };
        }

        /* tslint:enable:no-bitwise */
        // State handlers
        function setDepthTestEnable(enable) {
            if (currentState.depthTestEnable !== enable) {
                currentState.depthTestEnable = enable;
                if (enable) {
                    gl.enable(gl.DEPTH_TEST);
                } else {
                    gl.disable(gl.DEPTH_TEST);
                }

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setDepthFunc(func) {
            if (currentState.depthFunc !== func) {
                currentState.depthFunc = func;
                gl.depthFunc(func);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setDepthMask(enable) {
            if (currentState.depthMask !== enable) {
                currentState.depthMask = enable;
                gl.depthMask(enable);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setBlendEnable(enable) {
            if (currentState.blendEnable !== enable) {
                currentState.blendEnable = enable;
                if (enable) {
                    gl.enable(gl.BLEND);
                } else {
                    gl.disable(gl.BLEND);
                }

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setBlendFunc(src, dst) {
            if (currentState.blendSrc !== src || currentState.blendDst !== dst) {
                currentState.blendSrc = src;
                currentState.blendDst = dst;
                gl.blendFunc(src, dst);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setCullFaceEnable(enable) {
            if (currentState.cullFaceEnable !== enable) {
                currentState.cullFaceEnable = enable;
                if (enable) {
                    gl.enable(gl.CULL_FACE);
                } else {
                    gl.disable(gl.CULL_FACE);
                }

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setCullFace(face) {
            if (currentState.cullFace !== face) {
                currentState.cullFace = face;
                gl.cullFace(face);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setFrontFace(face) {
            if (currentState.frontFace !== face) {
                currentState.frontFace = face;
                gl.frontFace(face);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setColorMask(mask0, mask1, mask2, mask3) {
            var colorMask = currentState.colorMask;
            if (colorMask[0] !== mask0 || colorMask[1] !== mask1 || colorMask[2] !== mask2 || colorMask[3] !== mask3) {
                colorMask[0] = mask0;
                colorMask[1] = mask1;
                colorMask[2] = mask2;
                colorMask[3] = mask3;
                gl.colorMask(mask0, mask1, mask2, mask3);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setStencilTestEnable(enable) {
            if (currentState.stencilTestEnable !== enable) {
                currentState.stencilTestEnable = enable;
                if (enable) {
                    gl.enable(gl.STENCIL_TEST);
                } else {
                    gl.disable(gl.STENCIL_TEST);
                }

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setStencilFunc(stencilFunc, stencilRef, stencilMask) {
            if (currentState.stencilFunc !== stencilFunc || currentState.stencilRef !== stencilRef || currentState.stencilMask !== stencilMask) {
                currentState.stencilFunc = stencilFunc;
                currentState.stencilRef = stencilRef;
                currentState.stencilMask = stencilMask;
                gl.stencilFunc(stencilFunc, stencilRef, stencilMask);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setStencilOp(stencilFail, stencilZfail, stencilZpass) {
            if (currentState.stencilFail !== stencilFail || currentState.stencilZFail !== stencilZfail || currentState.stencilZPass !== stencilZpass) {
                currentState.stencilFail = stencilFail;
                currentState.stencilZFail = stencilZfail;
                currentState.stencilZPass = stencilZpass;
                gl.stencilOp(stencilFail, stencilZfail, stencilZpass);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setPolygonOffsetFillEnable(enable) {
            if (currentState.polygonOffsetFillEnable !== enable) {
                currentState.polygonOffsetFillEnable = enable;
                if (enable) {
                    gl.enable(gl.POLYGON_OFFSET_FILL);
                } else {
                    gl.disable(gl.POLYGON_OFFSET_FILL);
                }

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setPolygonOffset(factor, units) {
            if (currentState.polygonOffsetFactor !== factor || currentState.polygonOffsetUnits !== units) {
                currentState.polygonOffsetFactor = factor;
                currentState.polygonOffsetUnits = units;
                gl.polygonOffset(factor, units);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function setLineWidth(lineWidth) {
            if (currentState.lineWidth !== lineWidth) {
                currentState.lineWidth = lineWidth;
                gl.lineWidth(lineWidth);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetDepthTestEnable() {
            //setDepthTestEnable(true);
            if (!currentState.depthTestEnable) {
                currentState.depthTestEnable = true;
                gl.enable(gl.DEPTH_TEST);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetDepthFunc() {
            //setDepthFunc(defaultDepthFunc);
            var func = defaultDepthFunc;
            if (currentState.depthFunc !== func) {
                currentState.depthFunc = func;
                gl.depthFunc(func);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetDepthMask() {
            //setDepthMask(true);
            if (!currentState.depthMask) {
                currentState.depthMask = true;
                gl.depthMask(true);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetBlendEnable() {
            //setBlendEnable(false);
            if (currentState.blendEnable) {
                currentState.blendEnable = false;
                gl.disable(gl.BLEND);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetBlendFunc() {
            //setBlendFunc(defaultBlendFuncSrc, defaultBlendFuncDst);
            var src = defaultBlendFuncSrc;
            var dst = defaultBlendFuncDst;
            if (currentState.blendSrc !== src || currentState.blendDst !== dst) {
                currentState.blendSrc = src;
                currentState.blendDst = dst;
                gl.blendFunc(src, dst);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetCullFaceEnable() {
            //setCullFaceEnable(true);
            if (!currentState.cullFaceEnable) {
                currentState.cullFaceEnable = true;
                gl.enable(gl.CULL_FACE);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetCullFace() {
            //setCullFace(defaultCullFace);
            var face = defaultCullFace;
            if (currentState.cullFace !== face) {
                currentState.cullFace = face;
                gl.cullFace(face);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetFrontFace() {
            //setFrontFace(defaultFrontFace);
            var face = defaultFrontFace;
            if (currentState.frontFace !== face) {
                currentState.frontFace = face;
                gl.frontFace(face);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetColorMask() {
            //setColorMask(true, true, true, true);
            var colorMask = currentState.colorMask;
            if (colorMask[0] !== true || colorMask[1] !== true || colorMask[2] !== true || colorMask[3] !== true) {
                colorMask[0] = true;
                colorMask[1] = true;
                colorMask[2] = true;
                colorMask[3] = true;
                gl.colorMask(true, true, true, true);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetStencilTestEnable() {
            //setStencilTestEnable(false);
            if (currentState.stencilTestEnable) {
                currentState.stencilTestEnable = false;
                gl.disable(gl.STENCIL_TEST);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetStencilFunc() {
            //setStencilFunc(defaultStencilFunc, 0, 0xffffffff);
            var stencilFunc = defaultStencilFunc;
            if (currentState.stencilFunc !== stencilFunc || currentState.stencilRef !== 0 || currentState.stencilMask !== 0xffffffff) {
                currentState.stencilFunc = stencilFunc;
                currentState.stencilRef = 0;
                currentState.stencilMask = 0xffffffff;
                gl.stencilFunc(stencilFunc, 0, 0xffffffff);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetStencilOp() {
            //setStencilOp(defaultStencilOp, defaultStencilOp, defaultStencilOp);
            var stencilOp = defaultStencilOp;
            if (currentState.stencilFail !== stencilOp || currentState.stencilZFail !== stencilOp || currentState.stencilZPass !== stencilOp) {
                currentState.stencilFail = stencilOp;
                currentState.stencilZFail = stencilOp;
                currentState.stencilZPass = stencilOp;
                gl.stencilOp(stencilOp, stencilOp, stencilOp);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetPolygonOffsetFillEnable() {
            //setPolygonOffsetFillEnable(false);
            if (currentState.polygonOffsetFillEnable) {
                currentState.polygonOffsetFillEnable = false;
                gl.disable(gl.POLYGON_OFFSET_FILL);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetPolygonOffset() {
            //setPolygonOffset(0, 0);
            if (currentState.polygonOffsetFactor !== 0 || currentState.polygonOffsetUnits !== 0) {
                currentState.polygonOffsetFactor = 0;
                currentState.polygonOffsetUnits = 0;
                gl.polygonOffset(0, 0);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function resetLineWidth() {
            //setLineWidth(1);
            if (currentState.lineWidth !== 1) {
                currentState.lineWidth = 1;
                gl.lineWidth(1);

                if (debug) {
                    gd.metrics.renderStateChanges += 1;
                }
            }
        }

        function parseBoolean(state) {
            if (typeof state !== 'boolean') {
                return [(state ? true : false)];
            }
            return [state];
        }

        function parseEnum(state) {
            if (typeof state !== 'number') {
                // TODO
                return null;
            }
            return [state];
        }

        function parseEnum2(state) {
            if (typeof state === 'object') {
                var value0 = state[0], value1 = state[1];
                if (typeof value0 !== 'number') {
                    // TODO
                    return null;
                }
                if (typeof value1 !== 'number') {
                    // TODO
                    return null;
                }
                return [value0, value1];
            }
            return null;
        }

        function parseEnum3(state) {
            if (typeof state === 'object') {
                var value0 = state[0], value1 = state[1], value2 = state[2];
                if (typeof value0 !== 'number') {
                    // TODO
                    return null;
                }
                if (typeof value1 !== 'number') {
                    // TODO
                    return null;
                }
                if (typeof value2 !== 'number') {
                    // TODO
                    return null;
                }
                return [value0, value1, value2];
            }
            return null;
        }

        function parseFloat(state) {
            if (typeof state !== 'number') {
                // TODO
                return null;
            }
            return [state];
        }

        function parseFloat2(state) {
            if (typeof state === 'object') {
                var value0 = state[0], value1 = state[1];
                if (typeof value0 !== 'number') {
                    // TODO
                    return null;
                }
                if (typeof value1 !== 'number') {
                    // TODO
                    return null;
                }
                return [value0, value1];
            }
            return null;
        }

        function parseColorMask(state) {
            if (typeof state === 'object') {
                var value0 = state[0], value1 = state[1], value2 = state[2], value3 = state[3];
                if (typeof value0 !== 'number' && typeof value0 !== 'boolean') {
                    // TODO
                    return null;
                }
                if (typeof value1 !== 'number' && typeof value1 !== 'boolean') {
                    // TODO
                    return null;
                }
                if (typeof value2 !== 'number' && typeof value2 !== 'boolean') {
                    // TODO
                    return null;
                }
                if (typeof value3 !== 'number' && typeof value3 !== 'boolean') {
                    // TODO
                    return null;
                }
                return [!!value0, !!value1, !!value2, !!value3];
            }
            return null;
        }

        var stateHandlers = {};
        var addStateHandler = function addStateHandlerFn(name, sf, rf, pf, dv) {
            stateHandlers[name] = {
                set: sf,
                reset: rf,
                parse: pf,
                defaultValues: dv
            };
        };
        addStateHandler("DepthTestEnable", setDepthTestEnable, resetDepthTestEnable, parseBoolean, [true]);
        addStateHandler("DepthFunc", setDepthFunc, resetDepthFunc, parseEnum, [defaultDepthFunc]);
        addStateHandler("DepthMask", setDepthMask, resetDepthMask, parseBoolean, [true]);
        addStateHandler("BlendEnable", setBlendEnable, resetBlendEnable, parseBoolean, [false]);
        addStateHandler("BlendFunc", setBlendFunc, resetBlendFunc, parseEnum2, [defaultBlendFuncSrc, defaultBlendFuncDst]);
        addStateHandler("CullFaceEnable", setCullFaceEnable, resetCullFaceEnable, parseBoolean, [true]);
        addStateHandler("CullFace", setCullFace, resetCullFace, parseEnum, [defaultCullFace]);
        addStateHandler("FrontFace", setFrontFace, resetFrontFace, parseEnum, [defaultFrontFace]);
        addStateHandler("ColorMask", setColorMask, resetColorMask, parseColorMask, [true, true, true, true]);
        addStateHandler("StencilTestEnable", setStencilTestEnable, resetStencilTestEnable, parseBoolean, [false]);
        addStateHandler("StencilFunc", setStencilFunc, resetStencilFunc, parseEnum3, [defaultStencilFunc, 0, 0xffffffff]);
        addStateHandler("StencilOp", setStencilOp, resetStencilOp, parseEnum3, [defaultStencilOp, defaultStencilOp, defaultStencilOp]);
        addStateHandler("PolygonOffsetFillEnable", setPolygonOffsetFillEnable, resetPolygonOffsetFillEnable, parseBoolean, [false]);
        addStateHandler("PolygonOffset", setPolygonOffset, resetPolygonOffset, parseFloat2, [0, 0]);
        if (!gd._fixIE) {
            addStateHandler("LineWidth", setLineWidth, resetLineWidth, parseFloat, [1]);
        }
        gd._stateHandlers = stateHandlers;

        gd.syncState();

        gd.videoRam = 0;
        gd.desktopWidth = window.screen.width;
        gd.desktopHeight = window.screen.height;

        if (Object.defineProperty) {
            Object.defineProperty(gd, "fullscreen", {
                get: function getFullscreenFn() {
                    return (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement ? true : false);
                },
                set: function setFullscreenFn(newFullscreen) {
                    gd.requestFullScreen(newFullscreen);
                },
                enumerable: true,
                configurable: false
            });

            /* tslint:disable:no-empty */
            gd.checkFullScreen = function dummyCheckFullScreenFn() {
            };
            /* tslint:enable:no-empty */
        } else {
            gd.fullscreen = false;
            gd._oldFullscreen = false;
        }

        gd._clientStateMask = 0;
        gd._attributeMask = 0;
        gd._activeTechnique = null;
        gd._activeIndexBuffer = null;
        gd._bindedVertexBuffer = null;
        gd._activeRenderTarget = null;

        gd._semanticsOffsets = [];
        for (n = 0; n < 16; n += 1) {
            gd._semanticsOffsets[n] = {
                vertexBuffer: null,
                offset: 0
            };
        }

        gd._immediateVertexBuffer = gd.createVertexBuffer({
            numVertices: (256 * 1024 / 16),
            attributes: ['FLOAT4'],
            dynamic: true,
            'transient': true
        });
        gd._immediatePrimitive = -1;
        gd._immediateSemantics = [];

        gd.fps = 0;
        gd._numFrames = 0;
        gd._previousFrameTime = TurbulenzEngine.getTime();

        gd._techniqueParametersArray = [];

        // Need a temporary elements to test capabilities
        var video = document.createElement('video');
        var supportedVideoExtensions = {};
        if (video) {
            if (video.canPlayType('video/webm')) {
                supportedVideoExtensions.webm = true;
            }
            if (video.canPlayType('video/mp4')) {
                supportedVideoExtensions.mp4 = true;
                supportedVideoExtensions.m4v = true;
            }
        }
        gd._supportedVideoExtensions = supportedVideoExtensions;
        video = null;

        return gd;
    };
    WebGLGraphicsDevice.version = 1;
    return WebGLGraphicsDevice;
})();

WebGLGraphicsDevice.prototype.SEMANTIC_POSITION = 0;
WebGLGraphicsDevice.prototype.SEMANTIC_POSITION0 = 0;
WebGLGraphicsDevice.prototype.SEMANTIC_BLENDWEIGHT = 1;
WebGLGraphicsDevice.prototype.SEMANTIC_BLENDWEIGHT0 = 1;
WebGLGraphicsDevice.prototype.SEMANTIC_NORMAL = 2;
WebGLGraphicsDevice.prototype.SEMANTIC_NORMAL0 = 2;
WebGLGraphicsDevice.prototype.SEMANTIC_COLOR = 3;
WebGLGraphicsDevice.prototype.SEMANTIC_COLOR0 = 3;
WebGLGraphicsDevice.prototype.SEMANTIC_COLOR1 = 4;
WebGLGraphicsDevice.prototype.SEMANTIC_SPECULAR = 4;
WebGLGraphicsDevice.prototype.SEMANTIC_FOGCOORD = 5;
WebGLGraphicsDevice.prototype.SEMANTIC_TESSFACTOR = 5;
WebGLGraphicsDevice.prototype.SEMANTIC_PSIZE0 = 6;
WebGLGraphicsDevice.prototype.SEMANTIC_BLENDINDICES = 7;
WebGLGraphicsDevice.prototype.SEMANTIC_BLENDINDICES0 = 7;
WebGLGraphicsDevice.prototype.SEMANTIC_TEXCOORD = 8;
WebGLGraphicsDevice.prototype.SEMANTIC_TEXCOORD0 = 8;
WebGLGraphicsDevice.prototype.SEMANTIC_TEXCOORD1 = 9;
WebGLGraphicsDevice.prototype.SEMANTIC_TEXCOORD2 = 10;
WebGLGraphicsDevice.prototype.SEMANTIC_TEXCOORD3 = 11;
WebGLGraphicsDevice.prototype.SEMANTIC_TEXCOORD4 = 12;
WebGLGraphicsDevice.prototype.SEMANTIC_TEXCOORD5 = 13;
WebGLGraphicsDevice.prototype.SEMANTIC_TEXCOORD6 = 14;
WebGLGraphicsDevice.prototype.SEMANTIC_TEXCOORD7 = 15;
WebGLGraphicsDevice.prototype.SEMANTIC_TANGENT = 14;
WebGLGraphicsDevice.prototype.SEMANTIC_TANGENT0 = 14;
WebGLGraphicsDevice.prototype.SEMANTIC_BINORMAL0 = 15;
WebGLGraphicsDevice.prototype.SEMANTIC_BINORMAL = 15;
WebGLGraphicsDevice.prototype.SEMANTIC_PSIZE = 6;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR0 = 0;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR1 = 1;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR2 = 2;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR3 = 3;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR4 = 4;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR5 = 5;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR6 = 6;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR7 = 7;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR8 = 8;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR9 = 9;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR10 = 10;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR11 = 11;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR12 = 12;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR13 = 13;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR14 = 14;
WebGLGraphicsDevice.prototype.SEMANTIC_ATTR15 = 15;

// Add any new additions need to go into into src/engine/pixelformat.h
// and engine/tslib/turbulenz.d.ts.
WebGLGraphicsDevice.prototype.PIXELFORMAT_A8 = 0;
WebGLGraphicsDevice.prototype.PIXELFORMAT_L8 = 1;
WebGLGraphicsDevice.prototype.PIXELFORMAT_L8A8 = 2;
WebGLGraphicsDevice.prototype.PIXELFORMAT_R5G5B5A1 = 3;
WebGLGraphicsDevice.prototype.PIXELFORMAT_R5G6B5 = 4;
WebGLGraphicsDevice.prototype.PIXELFORMAT_R4G4B4A4 = 5;
WebGLGraphicsDevice.prototype.PIXELFORMAT_R8G8B8A8 = 6;
WebGLGraphicsDevice.prototype.PIXELFORMAT_R8G8B8 = 7;
WebGLGraphicsDevice.prototype.PIXELFORMAT_D24S8 = 8;
WebGLGraphicsDevice.prototype.PIXELFORMAT_D16 = 9;
WebGLGraphicsDevice.prototype.PIXELFORMAT_DXT1 = 10;
WebGLGraphicsDevice.prototype.PIXELFORMAT_DXT3 = 11;
WebGLGraphicsDevice.prototype.PIXELFORMAT_DXT5 = 12;
WebGLGraphicsDevice.prototype.PIXELFORMAT_S8 = 13;
WebGLGraphicsDevice.prototype.PIXELFORMAT_RGBA32F = 14;
WebGLGraphicsDevice.prototype.PIXELFORMAT_RGB32F = 15;
WebGLGraphicsDevice.prototype.PIXELFORMAT_RGBA16F = 16;
WebGLGraphicsDevice.prototype.PIXELFORMAT_RGB16F = 17;
WebGLGraphicsDevice.prototype.PIXELFORMAT_D32 = 18;
