#pragma OPENCL EXTENSION cl_khr_fp64 : enable
#pragma OPENCL FP_CONTRACT OFF

double next_r(__private double *s) {
    long n = ((long)*s * 16807L) % 2147483647L;
    if(n <= 0) n += 2147483647L;
    *s = (double)n;
    return *s / 2147483647.0;
}
int rnd(__private double *s,int a,int b){return a+(int)((b+1-a)*next_r(s));}
uint mix_seed(uint a,uint b,uint ws){
    uint v2=((a-b)-ws)^(ws>>13);
    uint v1=((b-v2)-ws)^(v2<<8);
    uint v3=((ws-v2)-v1)^(v1>>13);
    v2=((v2-v1)-v3)^(v3>>12);
    v1=((v1-v2)-v3)^(v2<<16);
    v3=((v3-v2)-v1)^(v1>>5);
    v2=((v2-v1)-v3)^(v3>>3);
    v1=((v1-v2)-v3)^(v2<<10);
    return ((v3-v2)-v1)^(v1>>15);
}
double pos_seed(uint ws,double x,double y){
    uint a=ws^0x93262e6fU;
    x+=(double)(a&4095); y+=(double)((a>>12)&4095);
    uint e=(uint)((ulong)((long)(x*134217727.0)));
    double material;
    if(fabs(y)>=102400.0||fabs(x)<=1.0)material=y*134217727.0;
    else {double work=y*3483.328;work+=(double)e;material=y*work;}
    uint f=(uint)((ulong)((long)material));
    uint g=mix_seed(e,f,ws);
    const uint table[17]={0,4,6,25,12,39,52,9,21,64,78,92,104,118,18,32,44};
    uint t=g+(uint)(g<0x80000000U)+(uint)(g==0);
    t-=g/252645135U;
    t+=(uint)((g%252645135U<table[g/252645135U])&&(g<0xc3c3c3c7U||g>=0xc3c3c401U));
    t=(t+(uint)(g>0x80000000U))>>1;
    t+=(uint)(g==0xffffffffU);
    double s=(double)t;next_r(&s);
    for(uint i=0;i<(ws&3);i++)next_r(&s);
    return s;
}
// IDs use the order of the exact upstream material lists.
int flask(uint ws){
    double s=pos_seed(ws,-4.5,-4.0);int r=rnd(&s,1,100);
    if(r<=65){r=rnd(&s,1,100);return r<=10?20:r<=20?28:r<=30?48:r<=40?24:r<=50?44:26;}
    if(r<=70)return 2;
    if(r<=99){rnd(&s,0,100);const int m[6]={0,49,29,7,8,13};return m[rnd(&s,0,5)];}
    r=rnd(&s,0,100000);if(r==666)return 25;if(r==79)return 36;
    return rnd(&s,0,1)==0?43:50;
}
int start_spell(uint ws){
    double s=pos_seed(ws,0,-11);
    rnd(&s,80,130);rnd(&s,2,3);rnd(&s,0,0);rnd(&s,20,28);
    rnd(&s,9,15);rnd(&s,25,40);rnd(&s,1,3);
    if(rnd(&s,1,100)<50)return rnd(&s,0,2)+1;
    return 0;
}
int start_bomb(uint ws){
    double s=pos_seed(ws,-1,0);
    rnd(&s,80,110);rnd(&s,1,1);rnd(&s,1,10);rnd(&s,3,8);rnd(&s,5,20);
    return rnd(&s,1,100)<50?rnd(&s,0,4):0;
}
void pick_recipe(__private double *s,uint ws,__private int *out){
    int m[4];int count=0;
    while(count<3){int v=(int)(next_r(s)*30.0);int duplicate=0;
        for(int i=0;i<count;i++)if(m[i]==v)duplicate=1;
        if(!duplicate)m[count++]=v;
    }
    m[3]=30+(int)(next_r(s)*18.0);
    double shuffle=(double)(ws>>1)+12534.0;next_r(&shuffle);
    for(int i=3;i>=0;i--){int j=(int)(next_r(&shuffle)*(double)(i+1));int v=m[i];m[i]=m[j];m[j]=v;}
    next_r(s);next_r(s);
    for(int i=0;i<3;i++)out[i]=m[i];
}
void recipes(uint ws,__private int *out){
    double s=(double)ws*0.17127000+1323.59030000;
    next_r(&s);for(int i=0;i<5;i++)next_r(&s);
    pick_recipe(&s,ws,out);pick_recipe(&s,ws,out+3);
}
__kernel void diagnostics(uint start,__global int *out){
    uint i=get_global_id(0),ws=start+i;
    out[i*9]=flask(ws);out[i*9+1]=start_spell(ws);out[i*9+2]=start_bomb(ws);
    int r[6];recipes(ws,r);for(int j=0;j<6;j++)out[i*9+3+j]=r[j];
}
