FROM python:3.6-alpine
RUN set -ex; \
    apk update && apk upgrade && \
    apk add --update --no-cache \
    bash nettle iptables openrc tzdata pkgconfig build-base cython libffi-dev jpeg-dev alpine-sdk zlib-dev proj-dev gfortran patch libgfortran llvm-config-8
RUN apk add --update --no-cache --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing \
        geos proj gdal binutils gdal-dev lapack-dev libquadmath musl musl-dev libgfortran openblas-dev
RUN pip install \
    pandas \
    cython \
    --upgrade --no-cache-dir
RUN pip install \
    geopandas \
    markdown2 \
    osmnx \
    --upgrade --no-cache-dir
RUN pip install \
    rasterio \
    scikit-image \
    holoviews \
    --upgrade --no-cache-dir
RUN pip install \
    datashader \
    --upgrade --no-cache-dir
RUN pip install \
    panel \
    fiona \
    shapely \
    --upgrade --no-cache-dir
RUN pip install \
    paramiko \
    ipywidgets \
    --upgrade --no-cache-dir
RUN pip install \
    pyproj \
    ipython \
    numpy \
    --upgrade --no-cache-dir
RUN pip install \
    xarray \
    matplotlib \
    geopandas \
    --upgrade --no-cache-dir
RUN pip install \
    seaborn \
    netCDF4 \
    requests \
    --upgrade --no-cache-dir
RUN pip install \
    ipyleaflet \
    hs_restclient \
    tqdm \
    --upgrade --no-cache-dir
RUN pip install \
    statsmodels \
    mapclassify \
    mplleaflet \
    --upgrade --no-cache-dir
RUN pip install \
    basemap-data-hires \
    earthpy \
    networkit \
    --upgrade --no-cache-dir
RUN pip install \
    cmocean \
    psycopg2 \
    fastparquet \
    --upgrade --no-cache-dir
RUN pip install \
    dask \
    folium \
    sphinx \
    --upgrade --no-cache-dir
RUN pip install \
    xlsxwriter \
    html5lib \
    lxml \
    --upgrade --no-cache-dir
RUN pip install \
    scikit-learn \
    owslib \
    sqlalchemy \
    --upgrade --no-cache-dir
RUN pip install \
    cartopy \
    pysal \
    pyshp \
    --upgrade --no-cache-dir
RUN pip install \
    geojson \
    cenpy \
    pykdtree \
    --upgrade --no-cache-dir
    # urban computation, simulation and analytics
RUN pip install \
    pandana \
    urbanaccess \
    plotly \
    --upgrade --no-cache-dir
RUN pip install \
    arcgis \
    esri \
    pyrasterframes \
    --upgrade --no-cache-dir
    # geospatial big data
RUN pip install \
    pyspark \
    geoplot \
    pyhdfs \
    --upgrade --no-cache-dir
RUN pip install \
    geopyspark \
    geospark \
    pyrasterframes \
    --upgrade --no-cache-dir
RUN pip install \
    pyhdfs \
    --upgrade --no-cache-dir
